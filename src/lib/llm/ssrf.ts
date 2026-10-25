import { lookup } from "node:dns/promises";
import net from "node:net";

/** 判断 IP 是否属于私网/环回/链路本地等敏感范围 */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::1" || v6 === "::" || v6.startsWith("fe80:") || v6.startsWith("fc") || v6.startsWith("fd"))
    return true;
  // IPv4-mapped IPv6
  const mapped = v6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return false;
}

/**
 * 校验外部请求目标：协议限 http(s)；DNS 解析的所有地址不得落在私网。
 * allowLocal=true 时放行环回/私网（用户显式授权本地模型如 Ollama）。
 * 返回规范化 URL；不通过则抛错。
 */
export async function assertUrlAllowed(rawUrl: string, allowLocal: boolean): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`非法 URL：${rawUrl}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`协议不允许：${url.protocol}（仅 http/https）`);
  }
  if (allowLocal) return url;
  const hostname = url.hostname;
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error(`拒绝访问私网地址：${hostname}`);
    return url;
  }
  const addrs = await lookup(hostname, { all: true, verbatim: true });
  if (!addrs.length) throw new Error(`DNS 解析失败：${hostname}`);
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new Error(`拒绝访问私网地址：${hostname} → ${a.address}`);
    }
  }
  return url;
}
