import type { Page } from "playwright";

export async function injectTokenIntoGrecaptcha(page: Page, token: string): Promise<boolean> {
    const success = await page.evaluate((solvedToken) => {
        try {
            console.log('Injecting token into grecaptcha');

            const grecaptchaConfig = (window as any).___grecaptcha_cfg;
            if (!grecaptchaConfig || !grecaptchaConfig.clients) {
                console.error('grecaptcha config not found');
                return false;
            }

            // Function to search for getResponse functions in relevant reCAPTCHA structures only
            function findAndOverrideGetResponse(obj: any, path: string = '', depth: number = 0): number {
                // Much more restrictive depth and path filtering
                if (depth > 4) return 0; // Limit depth to avoid DOM traversal
                let count = 0;
                
                // Skip DOM elements, React Fiber nodes, and other irrelevant objects
                if (isIrrelevantObject(obj)) return 0;
                
                for (const key in obj) {
                    try {
                        const value = obj[key];
                        const currentPath = path ? `${path}.${key}` : key;
                        
                        // Skip obviously irrelevant paths early
                        if (shouldSkipPath(key, currentPath)) continue;
                        
                        // Check if this object has a getResponse function
                        if (value && typeof value === 'object') {
                            if (typeof value.getResponse === 'function') {
                                console.log(`Found getResponse at: ${currentPath}.getResponse`);
                                value.getResponse = function(...args: any[]) {
                                    console.log(`Overridden getResponse called at ${currentPath}`);
                                    return solvedToken;
                                };
                                count++;
                            }
                            
                            // Also check for nested grecaptcha objects
                            if (value.grecaptcha && typeof value.grecaptcha === 'object') {
                                if (typeof value.grecaptcha.getResponse === 'function') {
                                    console.log(`Found grecaptcha.getResponse at: ${currentPath}.grecaptcha.getResponse`);
                                    value.grecaptcha.getResponse = function(...args: any[]) {
                                        console.log(`Overridden grecaptcha.getResponse called at ${currentPath}`);
                                        return solvedToken;
                                    };
                                    count++;
                                }
                            }
                            
                            // Only recurse into relevant reCAPTCHA structure
                            if (isRelevantForRecursion(key, value, depth)) {
                                count += findAndOverrideGetResponse(value, currentPath, depth + 1);
                            }
                        }
                    } catch (e) {
                        // Skip properties that can't be accessed
                        continue;
                    }
                }
                
                return count;
            }

            // Helper function to identify irrelevant objects that should be skipped entirely
            function isIrrelevantObject(obj: any): boolean {
                if (!obj || typeof obj !== 'object') return false;
                
                // Skip DOM elements
                if (obj.nodeType !== undefined || obj.tagName !== undefined) return true;
                
                // Skip React Fiber nodes
                if (obj._reactInternalFiber !== undefined || obj.__reactFiber$ !== undefined) return true;
                if (obj.stateNode !== undefined && obj.elementType !== undefined) return true;
                
                // Skip Window objects
                if (obj.window === obj) return true;
                
                // Skip Document objects
                if (obj.nodeType === 9) return true;
                
                // Skip jQuery objects
                if (obj.jquery !== undefined) return true;
                
                return false;
            }

            // Helper function to determine if a path should be skipped
            function shouldSkipPath(key: string, fullPath: string): boolean {
                // Skip DOM-related properties
                const domProperties = [
                    'parentNode', 'childNodes', 'children', 'nextSibling', 'previousSibling',
                    'parentElement', 'firstChild', 'lastChild', 'nextElementSibling', 
                    'previousElementSibling', 'ownerDocument', 'documentElement', 'body',
                    'offsetParent', 'offsetTop', 'offsetLeft', 'clientTop', 'clientLeft',
                    'scrollTop', 'scrollLeft', 'style', 'classList', 'attributes',
                    'innerHTML', 'outerHTML', 'textContent', 'innerText'
                ];
                
                // Skip React Fiber properties
                const reactProperties = [
                    '__reactFiber$', '_reactInternalFiber', 'stateNode', 'elementType',
                    'pendingProps', 'memoizedProps', 'updateQueue', 'memoizedState',
                    'dependencies', 'mode', 'effectTag', 'nextEffect', 'firstEffect',
                    'lastEffect', 'expirationTime', 'childExpirationTime', 'alternate',
                    'return', 'child', 'sibling', 'index', 'ref', 'key', 'type'
                ];
                
                // Skip Window/Document properties
                const windowProperties = [
                    'frames', 'defaultView', 'contentWindow', 'contentDocument',
                    'location', 'history', 'navigator', 'screen', 'console'
                ];
                
                if (domProperties.includes(key) || 
                    reactProperties.includes(key) || 
                    windowProperties.includes(key)) {
                    return true;
                }
                
                // Skip paths that contain React Fiber markers
                if (fullPath.includes('__reactFiber$') || 
                    fullPath.includes('stateNode') ||
                    fullPath.includes('ownerDocument') ||
                    fullPath.includes('defaultView.frames')) {
                    return true;
                }
                
                return false;
            }

            // Helper function to determine if we should recurse into this object
            function isRelevantForRecursion(key: string, value: any, currentDepth: number): boolean {
                // At depth 0-1, we want to explore most things in the client
                if (currentDepth <= 1) {
                    // But not DOM elements or React stuff
                    return !isIrrelevantObject(value);
                }
                
                // At deeper levels, only recurse into likely reCAPTCHA structures
                const relevantKeys = ['u', 'i', 'J', 'grecaptcha', 'getResponse', 'callback'];
                return relevantKeys.includes(key) && !isIrrelevantObject(value);
            }

            // Search through all clients - but use targeted approach first
            let totalOverrides = 0;
            for (const clientId in grecaptchaConfig.clients) {
                console.log(`Searching client ${clientId} for getResponse functions...`);
                const client = grecaptchaConfig.clients[clientId];
                
                // First, use the recursive search but with much better filtering
                totalOverrides += findAndOverrideGetResponse(client, `clients.${clientId}`);
            }

            // Direct targeted approach - check multiple possible patterns
            console.log('🎯 Performing comprehensive pattern checks...');
            for (const clientId in grecaptchaConfig.clients) {
                const client = grecaptchaConfig.clients[clientId];
                
                console.log(`Client ${clientId} available keys:`, Object.keys(client));
                
                // Check various possible patterns based on what we see in your logs
                const patternsToCheck = [
                    // Original patterns
                    { path: 'u.J', access: () => client.u?.J },
                    { path: 'i.J', access: () => client.i?.J },
                    // Lowercase variants (your logs show lowercase 'j')
                    { path: 'u.j', access: () => client.u?.j },
                    { path: 'i.j', access: () => client.i?.j },
                    // Other possible single letter properties from your client keys
                    { path: 'u.U', access: () => client.u?.U },
                    { path: 'u.P', access: () => client.u?.P },
                    { path: 'u.W', access: () => client.u?.W },
                    { path: 'u.Y', access: () => client.u?.Y },
                    { path: 'u.F', access: () => client.u?.F },
                    { path: 'u.R', access: () => client.u?.R },
                    { path: 'u.X', access: () => client.u?.X },
                    // Check the global client keys too
                    { path: 'j', access: () => client.j },
                    { path: 'U', access: () => client.U },
                    { path: 'P', access: () => client.P },
                    { path: 'W', access: () => client.W },
                    { path: 'Y', access: () => client.Y },
                    { path: 'F', access: () => client.F },
                    { path: 'R', access: () => client.R },
                    { path: 'X', access: () => client.X }
                ];
                
                for (const pattern of patternsToCheck) {
                    try {
                        const obj = pattern.access();
                        if (obj && typeof obj === 'object') {
                            console.log(`✅ Found ${pattern.path} object in client ${clientId}`);
                            console.log(`  ${pattern.path} keys:`, Object.keys(obj));
                            
                            // Check for direct getResponse
                            if (typeof obj.getResponse === 'function') {
                                console.log(`  🎯 Found getResponse at ${pattern.path}.getResponse - overriding!`);
                                obj.getResponse = function() {
                                    console.log(`🚀 ${pattern.path}.getResponse called - returning solved token`);
                                    return solvedToken;
                                };
                                totalOverrides++;
                            }
                            
                            // Check for grecaptcha.getResponse
                            if (obj.grecaptcha && typeof obj.grecaptcha === 'object') {
                                console.log(`  📁 Found grecaptcha in ${pattern.path}`);
                                if (typeof obj.grecaptcha.getResponse === 'function') {
                                    console.log(`  🎯 Found grecaptcha.getResponse at ${pattern.path}.grecaptcha.getResponse - overriding!`);
                                    obj.grecaptcha.getResponse = function() {
                                        console.log(`🚀 ${pattern.path}.grecaptcha.getResponse called - returning solved token`);
                                        return solvedToken;
                                    };
                                    totalOverrides++;
                                }
                            } else {
                                // Create grecaptcha object and add getResponse
                                obj.grecaptcha = {
                                    getResponse: function() {
                                        console.log(`🚀 ${pattern.path}.grecaptcha.getResponse (created) called - returning solved token`);
                                        return solvedToken;
                                    }
                                };
                                console.log(`  🔧 Created grecaptcha.getResponse at ${pattern.path}.grecaptcha.getResponse`);
                                totalOverrides++;
                            }
                            
                            // Also look for other common property names that might contain getResponse
                            Object.keys(obj).forEach(key => {
                                const value = obj[key];
                                if (typeof value === 'object' && value && typeof value.getResponse === 'function') {
                                    console.log(`  🎯 Found getResponse at ${pattern.path}.${key}.getResponse - overriding!`);
                                    value.getResponse = function() {
                                        console.log(`🚀 ${pattern.path}.${key}.getResponse called - returning solved token`);
                                        return solvedToken;
                                    };
                                    totalOverrides++;
                                }
                            });
                        }
                    } catch (e) {
                        // Skip patterns that can't be accessed
                        continue;
                    }
                }
            }

            // Global fallback - override window.grecaptcha.getResponse if it exists
            console.log('🎯 Attempting global grecaptcha override...');
            if (typeof (window as any).grecaptcha === 'object' && (window as any).grecaptcha) {
                console.log('✅ Found window.grecaptcha - overriding getResponse');
                (window as any).grecaptcha.getResponse = function(widgetId?: string) {
                    console.log('🚀 window.grecaptcha.getResponse called with widgetId:', widgetId);
                    return solvedToken;
                };
                totalOverrides++;
                
                // Also override render method to inject our getResponse
                const originalRender = (window as any).grecaptcha.render;
                if (typeof originalRender === 'function') {
                    (window as any).grecaptcha.render = function(container: any, parameters: any) {
                        console.log('🔧 grecaptcha.render intercepted, injecting getResponse override');
                        if (parameters && typeof parameters === 'object') {
                            const originalCallback = parameters.callback;
                            parameters.callback = function(token: string) {
                                console.log('🚀 grecaptcha callback intercepted, using solved token');
                                if (typeof originalCallback === 'function') {
                                    return originalCallback(solvedToken);
                                }
                                return solvedToken;
                            };
                        }
                        return originalRender.call(this, container, parameters);
                    };
                    totalOverrides++;
                }
            }

            console.log(`Total getResponse functions overridden: ${totalOverrides}`);

            if (totalOverrides === 0) {
                console.warn('❌ No getResponse functions found to override');
                console.log('🔍 Let me show you the complete structure for debugging:');
                
                // Show a simplified structure for debugging
                Object.keys(grecaptchaConfig.clients).forEach(clientId => {
                    const client = grecaptchaConfig.clients[clientId];
                    console.log(`\n📋 Client ${clientId} structure:`);
                    console.log('Keys:', Object.keys(client));
                    
                    if (client.u) {
                        console.log('  u keys:', Object.keys(client.u));
                        if (client.u.u) {
                            console.log('    u.u keys:', Object.keys(client.u.u));
                        }
                    }
                    
                    if (client.i) {
                        console.log('  i keys:', Object.keys(client.i));
                    }
                });
            } else {
                console.log('✅ Successfully overridden getResponse functions!');
            }

            return totalOverrides > 0;
        } catch (error) {
            console.error('Injection failed:', error);
            return false;
        }
    }, token);
    
    return success;
}