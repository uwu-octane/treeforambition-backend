import crypto from "node:crypto"
import type {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityProviderService,
  Logger,
} from "@medusajs/framework/types"
import { AbstractAuthModuleProvider, MedusaError } from "@medusajs/framework/utils"

type InjectedDependencies = {
  logger: Logger
}

type WechatMpAuthOptions = {
  apiBase?: string
  appId?: string
  appSecret?: string
  callbackUrl?: string
  scope?: "snsapi_base" | "snsapi_userinfo" | string
}

type WechatOAuthTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  openid?: string
  scope?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

type WechatUserInfoResponse = {
  openid?: string
  nickname?: string
  sex?: number
  province?: string
  city?: string
  country?: string
  headimgurl?: string
  privilege?: string[]
  unionid?: string
  errcode?: number
  errmsg?: string
}

const log = (entry: Record<string, unknown>) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }))
}

const readString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined

const readField = (
  source: AuthenticationInput["query"] | AuthenticationInput["body"],
  key: string
) => readString(source?.[key])

const appendSearchParams = (url: URL, params: Record<string, string>) => {
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })
}

class WechatMpAuthProvider extends AbstractAuthModuleProvider {
  static identifier = "wechat-mp"
  static DISPLAY_NAME = "WeChat Official Account"

  protected logger_: Logger
  protected options_: Required<WechatMpAuthOptions>

  constructor({ logger }: InjectedDependencies, options: WechatMpAuthOptions = {}) {
    // @ts-ignore Medusa provider base expects the original constructor arguments.
    super(...arguments)

    this.logger_ = logger
    this.options_ = {
      apiBase: options.apiBase || "https://api.weixin.qq.com",
      appId: options.appId || "",
      appSecret: options.appSecret || "",
      callbackUrl: options.callbackUrl || "",
      scope: options.scope || "snsapi_base",
    }
  }

  async register(): Promise<AuthenticationResponse> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "WeChat MP does not support direct registration. Use authenticate instead."
    )
  }

  async authenticate(
    req: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const t0 = Date.now()
    this.assertConfigured()

    const query = req.query ?? {}
    const body = req.body ?? {}

    if (readField(query, "error")) {
      return {
        success: false,
        error: readField(query, "error_description") || readField(query, "error") || "WeChat authorization failed",
      }
    }

    const callbackUrl = readField(body, "callback_url") || this.options_.callbackUrl
    const returnTo = readField(body, "return_to") || readField(query, "return_to")
    const stateKey = crypto.randomBytes(32).toString("hex")

    await authIdentityProviderService.setState(stateKey, {
      callback_url: callbackUrl,
      return_to: returnTo || "",
    })

    const authUrl = new URL("https://open.weixin.qq.com/connect/oauth2/authorize")
    appendSearchParams(authUrl, {
      appid: this.options_.appId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: this.options_.scope,
      state: stateKey,
    })

    log({
      level: "info",
      module: "wechat-mp-auth-provider",
      operation: "authenticate",
      duration: Date.now() - t0,
      scope: this.options_.scope,
    })

    return {
      success: true,
      location: `${authUrl.toString()}#wechat_redirect`,
    }
  }

  async validateCallback(
    req: AuthenticationInput,
    authIdentityProviderService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const t0 = Date.now()
    this.assertConfigured()

    const query = req.query ?? {}
    const body = req.body ?? {}

    if (readField(query, "error")) {
      return {
        success: false,
        error: readField(query, "error_description") || readField(query, "error") || "WeChat authorization failed",
      }
    }

    const code = readField(query, "code") || readField(body, "code")
    const stateKey = readField(query, "state") || readField(body, "state")

    if (!code) {
      return { success: false, error: "No WeChat OAuth code provided" }
    }

    if (!stateKey) {
      return { success: false, error: "No WeChat OAuth state provided" }
    }

    const state = await authIdentityProviderService.getState(stateKey)
    if (!state) {
      return { success: false, error: "No state provided, or session expired" }
    }

    try {
      const token = await this.exchangeCode(code)
      const userInfo = await this.getUserInfoIfNeeded(token)
      const entityId = this.getEntityId(token.openid)
      const userMetadata = this.buildUserMetadata(token, userInfo)

      let authIdentity
      try {
        authIdentity = await authIdentityProviderService.update(entityId, {
          provider_metadata: {
            access_token: token.access_token,
            expires_in: token.expires_in,
            refresh_token: token.refresh_token,
            scope: token.scope,
            unionid: token.unionid,
          },
          user_metadata: userMetadata,
        })
      } catch (error) {
        if ((error as { type?: string }).type !== MedusaError.Types.NOT_FOUND) {
          throw error
        }

        authIdentity = await authIdentityProviderService.create({
          entity_id: entityId,
          provider_metadata: {
            access_token: token.access_token,
            expires_in: token.expires_in,
            refresh_token: token.refresh_token,
            scope: token.scope,
            unionid: token.unionid,
          },
          user_metadata: userMetadata,
        })
      }

      log({
        level: "info",
        module: "wechat-mp-auth-provider",
        operation: "validateCallback",
        duration: Date.now() - t0,
        entityId,
        hasUnionId: Boolean(token.unionid || userInfo?.unionid),
      })

      return {
        success: true,
        authIdentity,
      }
    } catch (error) {
      log({
        level: "error",
        module: "wechat-mp-auth-provider",
        operation: "validateCallback",
        duration: Date.now() - t0,
        message: error instanceof Error ? error.message : String(error),
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : "WeChat callback validation failed",
      }
    }
  }

  private assertConfigured() {
    if (!this.options_.appId || !this.options_.appSecret || !this.options_.callbackUrl) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "WeChat MP auth is not configured. Set WECHAT_MP_APP_ID, WECHAT_MP_APP_SECRET, and WECHAT_MP_CALLBACK_URL."
      )
    }
  }

  private async exchangeCode(code: string): Promise<WechatOAuthTokenResponse & { openid: string }> {
    const url = new URL("/sns/oauth2/access_token", this.options_.apiBase)
    appendSearchParams(url, {
      appid: this.options_.appId,
      secret: this.options_.appSecret,
      code,
      grant_type: "authorization_code",
    })

    const response = await fetch(url.toString(), { method: "GET" })
    const data = (await response.json().catch(() => ({}))) as WechatOAuthTokenResponse

    if (!response.ok || data.errcode || !data.openid) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        data.errmsg || `Could not exchange WeChat OAuth code, status ${response.status}`
      )
    }

    return data as WechatOAuthTokenResponse & { openid: string }
  }

  private async getUserInfoIfNeeded(token: WechatOAuthTokenResponse) {
    if (!token.access_token || !token.openid || token.scope !== "snsapi_userinfo") {
      return null
    }

    const url = new URL("/sns/userinfo", this.options_.apiBase)
    appendSearchParams(url, {
      access_token: token.access_token,
      openid: token.openid,
      lang: "zh_CN",
    })

    const response = await fetch(url.toString(), { method: "GET" })
    const data = (await response.json().catch(() => ({}))) as WechatUserInfoResponse

    if (!response.ok || data.errcode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        data.errmsg || `Could not fetch WeChat user info, status ${response.status}`
      )
    }

    return data
  }

  private getEntityId(openid: string) {
    return `${this.options_.appId}:${openid}`
  }

  private buildUserMetadata(
    token: WechatOAuthTokenResponse & { openid: string },
    userInfo: WechatUserInfoResponse | null
  ) {
    const unionid = userInfo?.unionid || token.unionid

    return {
      wechat_app_id: this.options_.appId,
      wechat_open_id: token.openid,
      ...(unionid ? { wechat_union_id: unionid } : {}),
      ...(userInfo?.nickname ? { wechat_nickname: userInfo.nickname } : {}),
      ...(userInfo?.headimgurl ? { wechat_avatar_url: userInfo.headimgurl } : {}),
      wechat_last_login_source: "service_h5",
      wechat_authorized_at: new Date().toISOString(),
    }
  }
}

export default WechatMpAuthProvider
