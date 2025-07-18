// API para Sistema Imobiliário Marcelo Alves
// Versão simplificada para deploy no Vercel

// Dados em memória (simulando banco de dados)
let imoveis = [
    
];

let contatos = [];

let usuarios = [
    {
        id: 1,
        cpf: "12345678901",
        senha: "admin123", // Em produção, usar hash
        nome: "Administrador",
        email: "admin@marceloalvesimoveis.com.br"
    }
];

let sessions = new Map(); // Armazenar sessões ativas

// Função para gerar token simples
function generateToken(userId) {
    return Buffer.from(`${userId}:${Date.now()}`).toString('base64');
}

// Função para verificar token
function verifyToken(token) {
    if (!token) return null;
    
    try {
        const decoded = Buffer.from(token, 'base64').toString();
        const [userId, timestamp] = decoded.split(':');
        
        // Token válido por 24 horas
        if (Date.now() - parseInt(timestamp) > 24 * 60 * 60 * 1000) {
            return null;
        }
        
        return { userId: parseInt(userId) };
    } catch (error) {
        return null;
    }
}

// Função principal do Vercel
module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    const { url, method } = req;
    const path = url.replace('/api', '');
    
    try {
        // Parse body para POST/PUT
        let body = {};
        if (method === 'POST' || method === 'PUT') {
            body = await parseBody(req);
        }
        
        // Rotas públicas
        if (path === '/imoveis' && method === 'GET') {
            const imoveisDisponiveis = imoveis.filter(i => i.status === 'disponivel' && i.habilitado);
            
            // Parâmetros de paginação
            const url = new URL(req.url, `http://${req.headers.host}`);
            const page = parseInt(url.searchParams.get('page')) || 1;
            const limit = parseInt(url.searchParams.get('limit')) || 9;
            
            // Calcular paginação
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const totalItems = imoveisDisponiveis.length;
            const totalPages = Math.ceil(totalItems / limit);
            const imoveisPaginados = imoveisDisponiveis.slice(startIndex, endIndex);
            
            console.log(`Paginação: página ${page}, limite ${limit}, total ${totalItems}, páginas ${totalPages}`); // Debug
            
            // Retornar dados paginados
            res.status(200).json({
                imoveis: imoveisPaginados,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalItems: totalItems,
                    itemsPerPage: limit,
                    hasNextPage: page < totalPages,
                    hasPrevPage: page > 1
                }
            });
            return;
        }
        
        if (path.startsWith('/imoveis/') && method === 'GET') {
            const id = parseInt(path.split('/')[2]);
            const imovel = imoveis.find(i => i.id === id && i.status === 'disponivel' && i.habilitado);
            
            if (!imovel) {
                res.status(404).json({ error: 'Imóvel não encontrado' });
                return;
            }
            
            res.status(200).json(imovel);
            return;
        }
        
        if (path === '/contato' && method === 'POST') {
            console.log('=== RECEBENDO CONTATO ==='); // Debug
            console.log('Body recebido:', body); // Debug
            console.log('Headers:', req.headers); // Debug
            
            // Gerar ID único baseado no maior ID existente + 1
            const maxId = contatos.length > 0 ? Math.max(...contatos.map(c => c.id)) : 0;
            
            const novoContato = {
                id: maxId + 1,
                nome: body.nome,
                email: body.email,
                telefone: body.telefone || '',
                assunto: body.assunto,
                mensagem: body.mensagem,
                dataRecebimento: new Date().toISOString(),
                lido: false
            };
            
            contatos.push(novoContato);
            console.log('Novo contato adicionado:', novoContato); // Debug
            console.log('Total de contatos após adição:', contatos.length); // Debug
            console.log('Lista completa de contatos:', contatos); // Debug
            
            res.status(201).json({ message: 'Contato enviado com sucesso!' });
            return;
        }
        
        // Login
        if (path === '/auth/login' && method === 'POST') {
            const { cpf, senha } = body;
            
            if (!cpf || !senha) {
                res.status(400).json({ error: 'CPF e senha são obrigatórios' });
                return;
            }
            
            const usuario = usuarios.find(u => u.cpf === cpf.replace(/\D/g, '') && u.senha === senha);
            
            if (!usuario) {
                res.status(401).json({ error: 'CPF ou senha inválidos' });
                return;
            }
            
            const token = generateToken(usuario.id);
            sessions.set(token, usuario.id);
            
            res.status(200).json({
                token,
                usuario: {
                    id: usuario.id,
                    cpf: usuario.cpf,
                    nome: usuario.nome,
                    email: usuario.email
                }
            });
            return;
        }
        
        // Verificar autenticação para rotas administrativas
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        const auth = verifyToken(token);
        
        if (!auth) {
            res.status(401).json({ error: 'Token inválido ou expirado' });
            return;
        }
        
        // Rotas administrativas
        if (path === '/auth/me' && method === 'GET') {
            const usuario = usuarios.find(u => u.id === auth.userId);
            res.status(200).json({ usuario });
            return;
        }
        
        if (path === '/auth/logout' && method === 'POST') {
            if (token) {
                sessions.delete(token);
            }
            res.status(200).json({ message: 'Logout realizado com sucesso' });
            return;
        }
        
        if (path === '/admin/imoveis' && method === 'GET') {
            res.status(200).json(imoveis);
            return;
        }
        
        if (path === '/admin/imoveis' && method === 'POST') {
            const novoImovel = {
                id: Math.max(...imoveis.map(i => i.id)) + 1,
                ...body,
                dataCriacao: new Date().toISOString(),
                dataAtualizacao: new Date().toISOString()
            };
            
            imoveis.push(novoImovel);
            res.status(201).json(novoImovel);
            return;
        }
        
        if (path.startsWith('/admin/imoveis/') && method === 'PUT') {
            const id = parseInt(path.split('/')[3]);
            const index = imoveis.findIndex(i => i.id === id);
            
            if (index === -1) {
                res.status(404).json({ error: 'Imóvel não encontrado' });
                return;
            }
            
            imoveis[index] = {
                ...imoveis[index],
                ...body,
                dataAtualizacao: new Date().toISOString()
            };
            
            res.status(200).json(imoveis[index]);
            return;
        }
        
        if (path.startsWith('/admin/imoveis/') && method === 'DELETE') {
            const id = parseInt(path.split('/')[3]);
            const index = imoveis.findIndex(i => i.id === id);
            
            if (index === -1) {
                res.status(404).json({ error: 'Imóvel não encontrado' });
                return;
            }
            
            imoveis.splice(index, 1);
            res.status(200).json({ message: 'Imóvel excluído com sucesso' });
            return;
        }
        
        if (path === '/admin/contatos' && method === 'GET') {
            res.status(200).json(contatos);
            return;
        }
        
        if (path.startsWith('/admin/contatos/') && method === 'DELETE') {
            const id = parseInt(path.split('/')[3]);
            const index = contatos.findIndex(c => c.id === id);
            
            if (index === -1) {
                res.status(404).json({ error: 'Contato não encontrado' });
                return;
            }
            
            contatos.splice(index, 1);
            res.status(200).json({ message: 'Contato excluído com sucesso' });
            return;
        }
        
        // Rota não encontrada
        res.status(404).json({ error: 'Rota não encontrada' });
        
    } catch (error) {
        console.error('Erro na API:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
};

// Função para fazer parse do body
async function parseBody(req) {
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
        
        req.on('error', reject);
    });
}
