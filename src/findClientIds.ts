import type { Page } from "playwright";

export async function findAllClientIds(page: Page): Promise<string[]> {
    const clientIds = await page.evaluate(() => {
        const grecaptchaConfig = (window as any).___grecaptcha_cfg;
        
        if (!grecaptchaConfig || !grecaptchaConfig.clients) {
            console.log('No grecaptcha config found');
            return [];
        }
        
        const clientIds = Object.keys(grecaptchaConfig.clients);
        console.log('Found reCAPTCHA client IDs:', clientIds);
        
        // Log detailed info about each client
        clientIds.forEach(clientId => {
            const client = grecaptchaConfig.clients[clientId];
            console.log(`\n=== Client ID: ${clientId} ===`);
            console.log('Client object keys:', Object.keys(client));
            
            // Check for common patterns
            if (client.u) {
                console.log('  ✓ Has u object');
                if (client.u.J) {
                    console.log('    ✓ Has u.J object');
                    console.log('    u.J keys:', Object.keys(client.u.J));
                }
                if (client.u.u) {
                    console.log('    ✓ Has u.u object (callback container)');
                    if (client.u.u.callback) {
                        console.log('      ✓ Has callback function');
                    }
                }
            }
            
            if (client.i) {
                console.log('  ✓ Has i object');
                if (client.i.J) {
                    console.log('    ✓ Has i.J object');
                    console.log('    i.J keys:', Object.keys(client.i.J));
                }
            }
            
            // Check for widget info
            if (client.widget) {
                console.log('  ✓ Has widget info:', client.widget);
            }
            
            // Check for sitekey
            if (client.sitekey) {
                console.log('  ✓ Sitekey:', client.sitekey);
            }
            
            // Look for element info
            if (client.element) {
                console.log('  ✓ Associated element:', client.element);
            }
        });
        
        return clientIds;
    });
    
    return clientIds;
}

export async function getActiveClientId(page: Page): Promise<string | null | undefined> {
    const activeClientId = await page.evaluate(() => {
        const grecaptchaConfig = (window as any).___grecaptcha_cfg;
        
        if (!grecaptchaConfig || !grecaptchaConfig.clients) {
            return null;
        }
        
        const clientIds = Object.keys(grecaptchaConfig.clients);
        console.log('Checking clients for active reCAPTCHA:', clientIds);
        
        // Strategy 1: Find client with callback function (most likely active)
        for (const clientId of clientIds) {
            const client = grecaptchaConfig.clients[clientId];
            if (client.u && client.u.u && client.u.u.callback) {
                console.log(`Found client ${clientId} with callback - likely active`);
                return clientId;
            }
        }
        
        // Strategy 2: Find client with widget element visible on page
        for (const clientId of clientIds) {
            const client = grecaptchaConfig.clients[clientId];
            if (client.element) {
                const element = client.element;
                // Check if element is visible
                if (element.offsetParent !== null || element.offsetWidth > 0 || element.offsetHeight > 0) {
                    console.log(`Found client ${clientId} with visible element`);
                    return clientId;
                }
            }
        }
        
        // Strategy 3: Just return the first client if only one exists
        if (clientIds.length === 1) {
            console.log(`Only one client found: ${clientIds[0]}`);
            return clientIds[0];
        }
        
        // Strategy 4: Return '0' as fallback (most common)
        if (clientIds.includes('0')) {
            console.log('Defaulting to client ID "0"');
            return '0';
        }
        
        console.log('No suitable client found, returning first available:', clientIds[0]);
        return clientIds[0] || null;
    });
    
    return activeClientId;
}

export async function debugClientStructure(page: Page, clientId: string): Promise<void> {
    await page.evaluate((id) => {
        const grecaptchaConfig = (window as any).___grecaptcha_cfg;
        
        if (!grecaptchaConfig || !grecaptchaConfig.clients || !grecaptchaConfig.clients[id]) {
            console.log(`Client ${id} not found`);
            return;
        }
        
        const client = grecaptchaConfig.clients[id];
        console.log(`\n=== DETAILED CLIENT ${id} STRUCTURE ===`);
        
        // Focused inspection function that only looks at reCAPTCHA-relevant structure
        function inspectRelevantStructure(obj: any, path: string, maxDepth: number = 3, currentDepth: number = 0) {
            if (currentDepth >= maxDepth || !obj || typeof obj !== 'object') return;
            
            // Skip DOM elements and React Fiber nodes completely
            if (shouldSkipObject(obj)) return;
            
            Object.keys(obj).forEach(key => {
                // Skip irrelevant properties early
                if (shouldSkipProperty(key, path)) return;
                
                const value = obj[key];
                const currentPath = path ? `${path}.${key}` : key;
                
                if (typeof value === 'function') {
                    // Only log important functions
                    if (key === 'getResponse' || key === 'callback') {
                        console.log(`  🎯 FOUND ${key.toUpperCase()}: ${currentPath}()`);
                    }
                } else if (typeof value === 'object' && value !== null) {
                    // Only log important objects
                    if (['u', 'i', 'J', 'grecaptcha'].includes(key)) {
                        console.log(`  📁 FOUND ${key.toUpperCase()} object: ${currentPath}`);
                        
                        // Special detailed check for J objects
                        if (key === 'J') {
                            if (value.getResponse) {
                                console.log(`      🎯 HAS getResponse: ${currentPath}.getResponse`);
                            }
                            if (value.grecaptcha && value.grecaptcha.getResponse) {
                                console.log(`      🎯 HAS grecaptcha.getResponse: ${currentPath}.grecaptcha.getResponse`);
                            }
                        }
                        
                        // Recurse into relevant objects only
                        if (currentDepth < maxDepth - 1) {
                            inspectRelevantStructure(value, currentPath, maxDepth, currentDepth + 1);
                        }
                    } else if (key === 'callback' || key === 'sitekey' || key === 'element') {
                        // Log these important properties without recursing
                        console.log(`  📝 ${key}: ${typeof value === 'string' ? value : '[Object]'}`);
                    }
                }
            });
        }
        
        function shouldSkipObject(obj: any): boolean {
            // Skip DOM elements
            if (obj.nodeType !== undefined || obj.tagName !== undefined) return true;
            
            // Skip React Fiber nodes
            if (obj._reactInternalFiber !== undefined || obj.__reactFiber$ !== undefined) return true;
            if (obj.stateNode !== undefined && obj.elementType !== undefined) return true;
            
            // Skip Window/Document objects
            if (obj.window === obj || obj.nodeType === 9) return true;
            
            return false;
        }
        
        function shouldSkipProperty(key: string, currentPath: string): boolean {
            // Skip DOM properties
            const domProperties = [
                'parentNode', 'childNodes', 'children', 'nextSibling', 'previousSibling',
                'parentElement', 'firstChild', 'lastChild', 'nextElementSibling', 
                'previousElementSibling', 'ownerDocument', 'documentElement', 'body',
                'offsetParent', 'style', 'classList', 'innerHTML', 'outerHTML'
            ];
            
            // Skip React Fiber properties
            const reactProperties = [
                '__reactFiber$', '_reactInternalFiber', 'stateNode', 'elementType',
                'pendingProps', 'memoizedProps', 'updateQueue', 'memoizedState'
            ];
            
            // Skip Window/Document properties  
            const windowProperties = [
                'frames', 'defaultView', 'contentWindow', 'location', 'history'
            ];
            
            return domProperties.includes(key) || 
                   reactProperties.includes(key) || 
                   windowProperties.includes(key) ||
                   currentPath.includes('__reactFiber$') ||
                   currentPath.includes('ownerDocument');
        }
        
        inspectRelevantStructure(client, `clients.${id}`, 3);
        
    }, clientId);
}
