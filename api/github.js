export default async function handler(req, res) {
    // Allow CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_OWNER = 'btyservices';
    const GITHUB_REPO = 'Insurance-Verification';
    const FILE_PATH = 'insurance-forms-db.json';
    const BRANCH = 'main';

    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

    const headers = {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
    };

    try {
        if (req.method === 'GET') {
            const response = await fetch(url, { headers });
            if (response.status === 404) {
                return res.status(200).json({ content: null, sha: null });
            }
            if (!response.ok) throw new Error(`GitHub error: ${response.statusText}`);
            const data = await response.json();
            return res.status(200).json(data);
        }

        if (req.method === 'PUT') {
            const { content, sha } = req.body;
            const body = {
                message: 'Update insurance forms database',
                content,
                branch: BRANCH,
            };
            if (sha) body.sha = sha;

            const response = await fetch(url, {
                method: 'PUT',
                headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) throw new Error(`GitHub error: ${response.statusText}`);
            const data = await response.json();
            return res.status(200).json(data);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ error: error.message });
    }
}
