import express from 'express';
import type { Express } from 'express';
import { log } from '../../common/log';

export interface NodeBackendOptions {
    port: number;
}

export class NodeBackend {
    private app: Express;
    private server: ReturnType<typeof express>;
    private port: number;

    constructor(options: NodeBackendOptions) {
        this.port = options.port;
        this.app = express();
        this.app.use(express.json());
        this.setupRoutes();
    }

    private setupRoutes() {
        // Health check endpoint
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', backend: 'node' });
        });

        // Get nodes endpoint - returns empty for now
        this.app.get('/api/nodes', (req, res) => {
            res.json({ nodes: [], categories: [] });
        });

        // Run chain endpoint - stub for now
        this.app.post('/api/run', (req, res) => {
            res.json({ status: 'not_implemented', message: 'Node execution not yet implemented in Node.js backend' });
        });

        // System info endpoint
        this.app.get('/api/system', (req, res) => {
            res.json({
                backend: 'node',
                version: '1.0.0',
                platform: process.platform,
                arch: process.arch,
            });
        });
    }

    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    log.info(`Node.js backend started on port ${this.port}`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    log.error('Backend server error:', error);
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async stop(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                this.server.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        log.info('Node.js backend stopped');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    getUrl(): string {
        return `http://localhost:${this.port}`;
    }
}
