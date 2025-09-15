// External library types
import type { Page } from "playwright";

interface CallbackAnalysis {
    path: string;
    preview: string;
    fullFunction: string;
    usesGetResponse: boolean;
    usesParameter: boolean;
    parameterName: string | null;
}

interface TokenSubmissionResults {
    clients: Record<string, any>;
    potentialTokenCallbacks: CallbackAnalysis[];
    allCallbacks: CallbackAnalysis[];
    error?: string;
}

export async function findTokenSubmissionCallbackFixed(page: Page): Promise<TokenSubmissionResults> {
    return await page.evaluate(() => {
        const grecaptcha = (window as any).___grecaptcha_cfg;
        if (!grecaptcha?.clients) {
            return {
                clients: {},
                potentialTokenCallbacks: [],
                allCallbacks: [],
                error: 'No grecaptcha clients found'
            };
        }
        
        const results: TokenSubmissionResults = {
            clients: {},
            potentialTokenCallbacks: [],
            allCallbacks: []
        };
        
        for (const clientId in grecaptcha.clients) {
            const client = grecaptcha.clients[clientId];
            results.clients[clientId] = {};
            
            const callbacks = [
                { path: 'callback', fn: client?.callback },
                { path: 'u.u.callback', fn: client?.u?.u?.callback },
                { path: 'u.callback', fn: client?.u?.callback },
                { path: 'I.callback', fn: client?.I?.callback },
                { path: 'l', fn: client?.l },
                { path: 'u.u.l', fn: client?.u?.u?.l },
                { path: 'u.l.callback', fn: client?.u?.l?.callback },
            ];
            
            callbacks.forEach(item => {
                if (typeof item.fn === 'function') {
                    const fnString = item.fn.toString();
                    const first200Chars = fnString.substring(0, 200);
                    
                    const analysis = {
                        path: clientId + '.' + item.path,
                        preview: first200Chars,
                        fullFunction: fnString,
                        usesGetResponse: fnString.includes('getResponse()'),
                        usesParameter: false,
                        parameterName: null
                    };
                    
                    // Extract parameter name
                    const paramMatch = fnString.match(/function\s*\(([^)]*)\)|([^=\s]*)\s*=>/);
                    if (paramMatch) {
                        const param = (paramMatch[1] || paramMatch[2] || '').trim();
                        if (param && param.length > 0) {
                            analysis.parameterName = param;
                            
                            // Better check: look for parameter as standalone identifier
                            // Use word boundary regex to avoid false positives
                            const paramRegex = new RegExp('\\b' + param + '\\b', 'g');
                            const matches = fnString.match(paramRegex) || [];
                            
                            // If parameter appears more than once, it's likely being used
                            // (once in declaration, once+ in usage)
                            if (matches.length > 1) {
                                analysis.usesParameter = true;
                            }
                        }
                    }
                    
                    results.allCallbacks.push(analysis);
                    
                    // Flag potential token callbacks - must use parameter AND not rely solely on getResponse
                    if (analysis.usesParameter && !analysis.usesGetResponse) {
                        results.potentialTokenCallbacks.push(analysis);
                    }
                }
            });
        }
        
        return results;
    });
}

// Export alias for backward compatibility
export const findTokenSubmissionCallback = findTokenSubmissionCallbackFixed;