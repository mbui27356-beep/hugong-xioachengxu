// 运行配置。真机预览时把 API_BASE 改成电脑的局域网地址（如 http://192.168.1.10:3100/api）。
// 云开发开通后：改用 wx.cloud.callFunction 的传输实现（services/http.ts），并将 DEMO 设为 false。

export const API_BASE = 'http://127.0.0.1:3100/api'

/** 演示模式：允许模拟身份与模拟支付。生产构建必须为 false */
export const DEMO = true
