// External library types
import type { Page } from "playwright";

export interface CallbackInfo {
    found: boolean;
    clientId?: string | undefined;
    path?: string | undefined;
    method: string;
}

export async function findWorkingRecaptchaCallback(page: Page): Promise<CallbackInfo> {
    return await page.evaluate(() => {
        const grecaptcha = (window as any).___grecaptcha_cfg;
        
        if (!grecaptcha || !grecaptcha.clients) {
            return { found: false, method: 'none' };
        }
        
        // Simple array of patterns to test
        const patterns = [
            'callback',
            'u.u.callback', 
            'u.callback',
            'I.callback',
            'l.callback',
            'u.l.callback',
            'u.u.l'
        ];
        
        // Test each client and pattern combination
        for (const clientId in grecaptcha.clients) {
            const client = grecaptcha.clients[clientId];
            
            for (let i = 0; i < patterns.length; i++) {
                const patternName = patterns[i];
                let potentialCallback;
                
                // Manual path navigation to avoid compilation issues
                try {
                    if (patternName === 'callback') {
                        potentialCallback = client.callback;
                    } else if (patternName === 'u.u.callback') {
                        potentialCallback = client.u && client.u.u && client.u.u.callback;
                    } else if (patternName === 'u.callback') {
                        potentialCallback = client.u && client.u.callback;
                    } else if (patternName === 'I.callback') {
                        potentialCallback = client.I && client.I.callback;
                    } else if (patternName === 'l.callback') {
                        potentialCallback = client.l && client.l.callback;
                    } else if (patternName === 'u.l.callback') {
                        potentialCallback = client.u && client.u.l && client.u.l.callback;
                    } else if (patternName === 'u.u.l') {
                        potentialCallback = client.u && client.u.u && client.u.u.l;
                    }
                } catch (e) {
                    continue;
                }
                
                if (typeof potentialCallback === 'function') {
                    console.log('Found working callback: client[' + clientId + '].' + patternName);
                    
                    return {
                        found: true,
                        clientId: clientId,
                        path: patternName,
                        method: 'direct'
                    };
                }
            }
        }
        
        return { found: false, method: 'none' };
    });
}