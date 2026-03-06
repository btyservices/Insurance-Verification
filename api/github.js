export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = 'btyservices';
    const GITHUB_REPO = 'Insurance-Verification';
    const BRANCH = 'main';

    const headers = {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    };

    async function getFile(path) {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
        const response = await fetch(url, { headers });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`GitHub error: ${response.status} ${response.statusText}`);
        return response.json();
    }

    async function putFile(path, content, sha, message) {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
        const body = { message, content, branch: BRANCH };
        if (sha) body.sha = sha;
        const response = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`GitHub error: ${response.status} ${err}`);
        }
        return response.json();
    }

    async function deleteFile(path, sha, message) {
        const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
        const body = { message, sha, branch: BRANCH };
        const response = await fetch(url, { method: 'DELETE', headers, body: JSON.stringify(body) });
        if (!response.ok) throw new Error(`GitHub error: ${response.status}`);
        return response.json();
    }

    try {
        const { action } = req.query;

        // GET all forms metadata
        if (req.method === 'GET' && !action) {
            const data = await getFile('insurance-forms-db.json');
            if (!data) return res.status(200).json([]);
            const forms = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
            return res.status(200).json(forms);
        }

        // GET a specific PDF file
        if (req.method === 'GET' && action === 'getpdf') {
            const { filename } = req.query;
            const data = await getFile(`pdfs/${filename}`);
            if (!data) return res.status(404).json({ error: 'File not found' });
            return res.status(200).json({ content: data.content });
        }

        // PUT - save a new form
        if (req.method === 'PUT' && action === 'save') {
            const { metadata, pdfContent, pdfFilename } = req.body;

            if (!metadata || !pdfContent || !pdfFilename) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Save PDF file separately
            await putFile(`pdfs/${pdfFilename}`, pdfContent, null, `Add PDF: ${pdfFilename}`);

            // Update metadata list
            const dbData = await getFile('insurance-forms-db.json');
            let forms = [];
            let dbSha = null;
            if (dbData) {
                forms = JSON.parse(Buffer.from(dbData.content, 'base64').toString('utf8'));
                dbSha = dbData.sha;
            }
            forms.push(metadata);
            const newContent = Buffer.from(JSON.stringify(forms, null, 2)).toString('base64');
            await putFile('insurance-forms-db.json', newContent, dbSha, 'Update insurance forms database');

            return res.status(200).json({ success: true });
        }

        // DELETE a form
        if (req.method === 'DELETE') {
            const { id, pdfFilename } = req.body;

            try {
                const pdfData = await getFile(`pdfs/${pdfFilename}`);
                if (pdfData) await deleteFile(`pdfs/${pdfFilename}`, pdfData.sha, `Delete PDF: ${pdfFilename}`);
            } catch (e) {
                console.log('PDF delete error:', e);
            }

            const dbData = await getFile('insurance-forms-db.json');
            if (dbData) {
                let forms = JSON.parse(Buffer.from(dbData.content, 'base64').toString('utf8'));
                forms = forms.filter(f => f.id !== id);
                const newContent = Buffer.from(JSON.stringify(forms, null, 2)).toString('base64');
                await putFile('insurance-forms-db.json', newContent, dbData.sha, 'Update insurance forms database');
            }

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
