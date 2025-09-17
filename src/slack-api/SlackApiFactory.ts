import { type CookiesLoader } from "../cookie-management/index.js";
import { type ChromiumBrowser } from "playwright";
import { interceptSlackAuthWithCookies } from "./auth.js";
import { SlackApi } from "./SlackApi.js";

export class SlackApiFactory {

    private cookiesLoader: CookiesLoader;
    private workspaceUrl: string;
    private browser: ChromiumBrowser;

    constructor(cookiesLoader: CookiesLoader, workspaceUrl: string, browser: ChromiumBrowser) {
        this.cookiesLoader = cookiesLoader;
        this.workspaceUrl = workspaceUrl;
        this.browser = browser;
    }

    public async createSlackApi(): Promise<SlackApi> {
        const context = await this.browser.newContext();
        const page = await context.newPage();
        const authResult = await interceptSlackAuthWithCookies(
            page,
            this.cookiesLoader,
            this.workspaceUrl
        );

        // Clean up the browser context
        await context.close();

        return new SlackApi(authResult.token, authResult.cookies);
    }

}
