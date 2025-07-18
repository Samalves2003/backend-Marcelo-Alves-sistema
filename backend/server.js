const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configurações
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Dados em memória (será substituído pelo Firebase)
let usuarios = [
    {
        id: 1,
        cpf: '12345678901',
        senha: hashPassword('admin123'),
        nome: 'Marcelo Alves'
    }
];

let imoveis = [
    {
        id: 1,
        titulo: 'Casa 3 quartos no Jardim Atlântico',
        tipo: 'casa',
        finalidade: 'venda',
        preco: 450000,
        descricao: 'Linda casa com 3 quartos, 2 banheiros, sala ampla, cozinha planejada e quintal. Localizada em bairro residencial tranquilo.',
        quartos: 3,
        banheiros: 2,
        area: 120,
        endereco: 'Jardim Atlântico, São Paulo/SP',
        fotos: [
            'https://images.unsplash.com/photo-1568605114967-8130f3a36994?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        ],
        status: 'disponivel',
        habilitado: true,
        dataPublicacao: '2024-01-15T10:00:00Z',
        dataCriacao: new Date().toISOString(),
        dataAtualizacao: new Date().toISOString()
    },
    {
        id: 2,
        titulo: 'Apartamento 2 quartos Centro',
        tipo: 'apartamento',
        finalidade: 'aluguel',
        preco: 1800,
        descricao: 'Apartamento moderno com 2 quartos, 1 banheiro, sala integrada com cozinha. Próximo ao metrô e comércio.',
        quartos: 2,
        banheiros: 1,
        area: 65,
        endereco: 'Centro, São Paulo/SP',
        fotos: [
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'
        ],
        status: 'disponivel',
        habilitado: true,
        dataPublicacao: '2024-01-10T10:00:00Z',
        dataCriacao: new Date().toISOString(),
        dataAtualizacao: new Date().toISOString()
    }
];

let sessoes = new Map(); // Armazenar sessões ativas

// Utilitários
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (error) {
                reject(error);
            }
        });
    });
}

function setCORSHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJSON(res, statusCode, data) {
    setCORSHeaders(res);
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
    sendJSON(res, statusCode, { error: message });
}

function authenticateToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    return sessoes.get(token);
}

// Rotas da API
const routes = {
    // Autenticação
    'POST /api/auth/login': async (req, res) => {
        try {
            const { cpf, senha } = await parseBody(req);
            
            if (!cpf || !senha) {
                return sendError(res, 400, 'CPF e senha são obrigatórios');
            }
            
            const usuario = usuarios.find(u => u.cpf === cpf);
            if (!usuario || usuario.senha !== hashPassword(senha)) {
                return sendError(res, 401, 'CPF ou senha inválidos');
            }
            
            const token = generateToken();
            const sessao = {
                token,
                usuarioId: usuario.id,
                usuario: { id: usuario.id, cpf: usuario.cpf, nome: usuario.nome },
                dataLogin: new Date().toISOString()
            };
            
            sessoes.set(token, sessao);
            
            sendJSON(res, 200, {
                token,
                usuario: sessao.usuario,
                message: 'Login realizado com sucesso'
            });
            
        } catch (error) {
            console.error('Erro no login:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    },
    
    'POST /api/auth/logout': async (req, res) => {
        try {
            const sessao = authenticateToken(req);
            if (sessao) {
                sessoes.delete(sessao.token);
            }
            
            sendJSON(res, 200, { message: 'Logout realizado com sucesso' });
            
        } catch (error) {
            console.error('Erro no logout:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    },
    
    'GET /api/auth/me': async (req, res) => {
        try {
            const sessao = authenticateToken(req);
            if (!sessao) {
                return sendError(res, 401, 'Token inválido ou expirado');
            }
            
            sendJSON(res, 200, { usuario: sessao.usuario });
            
        } catch (error) {
            console.error('Erro ao verificar usuário:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    },
    
    // Imóveis públicos
    'GET /api/imoveis': async (req, res) => {
        try {
            const parsedUrl = url.parse(req.url, true);
            const query = parsedUrl.query;
            
            // Filtrar apenas imóveis disponíveis e habilitados
            let imoveisFiltrados = imoveis.filter(imovel => 
                imovel.status === 'disponivel' && imovel.habilitado
            );
            
            // Aplicar filtros da query
            if (query.tipo) {
                imoveisFiltrados = imoveisFiltrados.filter(imovel => 
                    imovel.tipo === query.tipo
                );
            }
            
            if (query.finalidade) {
                imoveisFiltrados = imoveisFiltrados.filter(imovel => 
                    imovel.finalidade === query.finalidade
                );
            }
            
            if (query.precoMin) {
                imoveisFiltrados = imoveisFiltrados.filter(imovel => 
                    imovel.preco >= parseInt(query.precoMin)
                );
            }
            
            if (query.precoMax) {
                imoveisFiltrados = imoveisFiltrados.filter(imovel => 
                    imovel.preco <= parseInt(query.precoMax)
                );
            }
            
            if (query.localizacao) {
                imoveisFiltrados = imoveisFiltrados.filter(imovel => 
                    imovel.endereco.toLowerCase().includes(query.localizacao.toLowerCase())
                );
            }
            
            // Ordenação
            const ordem = query.ordem || 'recente';
            switch (ordem) {
                case 'preco-menor':
                    imoveisFiltrados.sort((a, b) => a.preco - b.preco);
                    break;
                case 'preco-maior':
                    imoveisFiltrados.sort((a, b) => b.preco - a.preco);
                    break;
                case 'recente':
                default:
                    imoveisFiltrados.sort((a, b) => new Date(b.dataPublicacao) - new Date(a.dataPublicacao));
                    break;
            }
            
            sendJSON(res, 200, imoveisFiltrados);
            
        } catch (error) {
            console.error('Erro ao buscar imóveis:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    },
    
    'GET /api/imoveis/:id': async (req, res) => {
        try {
            const parsedUrl = url.parse(req.url);
            const id = parseInt(parsedUrl.pathname.split('/').pop());
            
            const imovel = imoveis.find(i => i.id === id && i.status === 'disponivel' && i.habilitado);
            
            if (!imovel) {
                return sendError(res, 404, 'Imóvel não encontrado');
            }
            
            sendJSON(res, 200, imovel);
            
        } catch (error) {
            console.error('Erro ao buscar imóvel:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    },
    
    // Imóveis administrativos (requer autenticação)
    'GET /api/admin/imoveis': async (req, res) => {
        try {
            const sessao = authenticateToken(req);
            if (!sessao) {
                return sendError(res, 401, 'Acesso negado');
            }
            
            const parsedUrl = url.parse(req.url, true);
            const query = parsedUrl.query;
            
            let imoveisFiltrados = [...imoveis];
            
            // Aplicar filtros
            if (query.status) {
                imoveisFiltrados = imoveisFiltrados.filter(imovel => 
                    imovel.status === query.status
                );
            }
            
            if (query.habilitado !== undefined) {
                const habilitado = query.habilitado === 'true';
                imoveisFiltrados = imoveisFiltrados.filter(imovel => 
                    imovel.habilitado === habilitado
                );
            }
            
            // Ordenar por data de criação (mais recentes primeiro)
            imoveisFiltrados.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
            
            sendJSON(res, 200, imoveisFiltrados);
            
        } catch (error) {
            console.error('Erro ao buscar imóveis admin:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    },
    
    'POST /api/admin/imoveis': async (req, res) => {
        try {
            const sessao = authenticateToken(req);
            if (!sessao) {
                return sendError(res, 401, 'Acesso negado');
            }
            
            const dadosImovel = await parseBody(req);
            
            // Validações básicas
            if (!dadosImovel.titulo || !dadosImovel.tipo || !dadosImovel.finalidade || !dadosImovel.preco) {
                return sendError(res, 400, 'Dados obrigatórios não informados');
            }
            
            const novoImovel = {
                id: Math.max(...imoveis.map(i => i.id), 0) + 1,
                titulo: dadosImovel.titulo,
                tipo: dadosImovel.tipo,
                finalidade: dadosImovel.finalidade,
                preco: parseFloat(dadosImovel.preco),
                descricao: dadosImovel.descricao || '',
                quartos: parseInt(dadosImovel.quartos) || 0,
                banheiros: parseInt(dadosImovel.banheiros) || 0,
                area: parseFloat(dadosImovel.area) || 0,
                endereco: dadosImovel.endereco || '',
                fotos: dadosImovel.fotos || [],
                status: dadosImovel.status || 'disponivel',
                habilitado: dadosImovel.habilitado !== false,
                dataPublicacao: new Date().toISOString(),
                dataCriacao: new Date().toISOString(),
                dataAtualizacao: new Date().toISOString()
            };
            
            imoveis.push(novoImovel);
            
            sendJSON(res, 201, novoImovel);
            
        } catch (error) {
            console.error('Erro ao criar imóvel:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    },
    
    'PUT /api/admin/imoveis/:id': async (req, res) => {
        try {
            const sessao = authenticateToken(req);
            if (!sessao) {
                return sendError(res, 401, 'Acesso negado');
            }
            
            const parsedUrl = url.parse(req.url);
            const id = parseInt(parsedUrl.pathname.split('/').pop());
            const dadosAtualizacao = await parseBody(req);
            
            const indiceImovel = imoveis.findIndex(i => i.id === id);
            if (indiceImovel === -1) {
                return sendError(res, 404, 'Imóvel não encontrado');
            }
            
            // Atualizar dados
            const imovelAtualizado = {
                ...imoveis[indiceImovel],
                ...dadosAtualizacao,
                id: id, // Garantir que o ID não seja alterado
                dataAtualizacao: new Date().toISOString()
            };
            
            // Validações
            if (dadosAtualizacao.preco) {
                imovelAtualizado.preco = parseFloat(dadosAtualizacao.preco);
            }
            if (dadosAtualizacao.quartos) {
                imovelAtualizado.quartos = parseInt(dadosAtualizacao.quartos);
            }
            if (dadosAtualizacao.banheiros) {
                imovelAtualizado.banheiros = parseInt(dadosAtualizacao.banheiros);
            }
            if (dadosAtualizacao.area) {
                imovelAtualizado.area = parseFloat(dadosAtualizacao.area);
            }
            
            imoveis[indiceImovel] = imovelAtualizado;
            
            sendJSON(res, 200, imovelAtualizado);
            
        } catch (error) {
            console.error('Erro ao atualizar imóvel:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    },
    
    'DELETE /api/admin/imoveis/:id': async (req, res) => {
        try {
            const sessao = authenticateToken(req);
            if (!sessao) {
                return sendError(res, 401, 'Acesso negado');
            }
            
            const parsedUrl = url.parse(req.url);
            const id = parseInt(parsedUrl.pathname.split('/').pop());
            
            const indiceImovel = imoveis.findIndex(i => i.id === id);
            if (indiceImovel === -1) {
                return sendError(res, 404, 'Imóvel não encontrado');
            }
            
            imoveis.splice(indiceImovel, 1);
            
            sendJSON(res, 200, { message: 'Imóvel excluído com sucesso' });
            
        } catch (error) {
            console.error('Erro ao excluir imóvel:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    },
    
    // Contato
    'POST /api/contato': async (req, res) => {
        try {
            const dadosContato = await parseBody(req);
            
            // Validações básicas
            if (!dadosContato.nome || !dadosContato.email || !dadosContato.mensagem) {
                return sendError(res, 400, 'Nome, email e mensagem são obrigatórios');
            }
            
            // Aqui você pode implementar o envio de email ou salvar no banco
            console.log('Novo contato recebido:', dadosContato);
            
            // Simular processamento
            const contato = {
                id: Date.now(),
                ...dadosContato,
                dataRecebimento: new Date().toISOString()
            };
            
            sendJSON(res, 200, { 
                message: 'Mensagem enviada com sucesso',
                contato: contato
            });
            
        } catch (error) {
            console.error('Erro ao processar contato:', error);
            sendError(res, 500, 'Erro interno do servidor');
        }
    }
};

// Servidor HTTP
const server = http.createServer(async (req, res) => {
    try {
        const parsedUrl = url.parse(req.url, true);
        const method = req.method;
        let pathname = parsedUrl.pathname;
        
        // Tratar parâmetros de rota (ex: /api/imoveis/123)
        let routeKey = `${method} ${pathname}`;
        let handler = routes[routeKey];
        
        // Se não encontrou rota exata, tentar com parâmetros
        if (!handler) {
            for (const route in routes) {
                const [routeMethod, routePath] = route.split(' ');
                if (routeMethod === method && routePath.includes(':')) {
                    const routeRegex = new RegExp('^' + routePath.replace(/:[^/]+/g, '([^/]+)') + '$');
                    if (routeRegex.test(pathname)) {
                        handler = routes[route];
                        break;
                    }
                }
            }
        }
        
        // Tratar OPTIONS para CORS
        if (method === 'OPTIONS') {
            setCORSHeaders(res);
            res.writeHead(200);
            res.end();
            return;
        }
        
        // Executar handler se encontrado
        if (handler) {
            await handler(req, res);
        } else {
            sendError(res, 404, 'Rota não encontrada');
        }
        
    } catch (error) {
        console.error('Erro no servidor:', error);
        sendError(res, 500, 'Erro interno do servidor');
    }
});

// Iniciar servidor
server.listen(PORT, HOST, () => {
    console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
    console.log(`📝 Usuário padrão: CPF: 12345678901, Senha: admin123`);
    console.log(`🏠 API de imóveis disponível em: http://${HOST}:${PORT}/api/imoveis`);
    console.log(`🔐 Painel admin: http://${HOST}:${PORT}/api/admin/imoveis`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Recebido SIGTERM, encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Recebido SIGINT, encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor encerrado');
        process.exit(0);
    });
});

