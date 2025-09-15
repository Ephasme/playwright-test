// External library types
import type { Page } from "playwright";

export async function injectTokenViaScriptManipulation(page: Page, token: string): Promise<boolean> {
    const success = await page.evaluate((solvedToken) => {
        try {
            const w = window as any;
            console.log('Injecting token via script manipulation approach');
            
            // Method 1: Override at the prototype level
            if (typeof w.grecaptcha === 'object' && w.grecaptcha) {
                console.log('Found window.grecaptcha, attempting prototype override');
                
                // Store original getResponse if it exists
                const originalGetResponse = w.grecaptcha.getResponse;
                
                // Override getResponse
                w.grecaptcha.getResponse = function(widgetId?: string) {
                    console.log('window.grecaptcha.getResponse called with widgetId:', widgetId);
                    return solvedToken;
                };
                
                console.log('Successfully overridden window.grecaptcha.getResponse');
            }
            
            // Method 2: Intercept all function calls that contain "getResponse"
            const originalDefineProperty = Object.defineProperty;
            Object.defineProperty = function<T>(obj: T, prop: string, descriptor: PropertyDescriptor): T {
                if (prop === 'getResponse' && typeof descriptor.value === 'function') {
                    console.log('Intercepted getResponse property definition on:', obj);
                    descriptor.value = function(...args: any[]) {
                        console.log('Intercepted getResponse called with args:', args);
                        return solvedToken;
                    };
                }
                return originalDefineProperty.call(this, obj, prop, descriptor) as T;
            };
            
            // Method 3: Monkey patch Function constructor to intercept function creation
            const originalFunction = w.Function;
            w.Function = function(...args: any[]) {
                const functionCode = args[args.length - 1];
                if (typeof functionCode === 'string' && functionCode.includes('getResponse')) {
                    console.log('Intercepted function creation containing getResponse');
                    // Return a function that always returns our token
                    return function() {
                        console.log('Intercepted function with getResponse called');
                        return solvedToken;
                    };
                }
                return originalFunction.apply(null, args);
            } as any;
            
            // Method 4: Override eval to intercept dynamic code execution
            const originalEval = w.eval;
            w.eval = function(code: string) {
                if (typeof code === 'string' && code.includes('getResponse')) {
                    console.log('Intercepted eval containing getResponse');
                    // Modify the code to return our token
                    const modifiedCode = code.replace(
                        /(\w+\.)?getResponse\s*\([^)]*\)/g,
                        `"${solvedToken}"`
                    );
                    return originalEval.call(this, modifiedCode);
                }
                return originalEval.call(this, code);
            };
            
            // Method 5: Search and replace in all script tags
            const scripts = document.querySelectorAll('script');
            let scriptCount = 0;
            
            scripts.forEach((script, index) => {
                if (script.textContent && script.textContent.includes('getResponse')) {
                    console.log(`Found getResponse in script tag ${index}`);
                    scriptCount++;
                    
                    try {
                        // Create a new script with modified content
                        const newScript = document.createElement('script');
                        const modifiedContent = script.textContent.replace(
                            /(\w+\.)?getResponse\s*\([^)]*\)/g,
                            `function(){return "${solvedToken}"}()`
                        );
                        
                        newScript.textContent = modifiedContent;
                        if (script.src) newScript.src = script.src;
                        if (script.type) newScript.type = script.type;
                        
                        // Replace the old script
                        script.parentNode?.replaceChild(newScript, script);
                        console.log(`Replaced script tag ${index} with modified version`);
                    } catch (error) {
                        console.warn(`Failed to replace script ${index}:`, error);
                    }
                }
            });
            
            console.log(`Processed ${scriptCount} script tags containing getResponse`);
            return true;
            
        } catch (error) {
            console.error('Script manipulation failed:', error);
            return false;
        }
    }, token);
    
    return success;
}

// Combined approach using both methods
export async function injectTokenComprehensive(page: Page, token: string): Promise<boolean> {
    console.log('Starting comprehensive token injection');
    
    // First try the comprehensive search approach
    const { injectTokenIntoGrecaptcha } = await import('./injectTokenIntoGrecaptcha.js');
    const searchResult = await injectTokenIntoGrecaptcha(page, token);
    
    if (searchResult) {
        console.log('Comprehensive search method succeeded');
        return true;
    }
    
    console.log('Comprehensive search method failed, trying script manipulation');
    
    // If that fails, try script manipulation
    const manipulationResult = await injectTokenViaScriptManipulation(page, token);
    
    if (manipulationResult) {
        console.log('Script manipulation method succeeded');
        return true;
    }
    
    console.log('Both methods failed');
    return false;
}
