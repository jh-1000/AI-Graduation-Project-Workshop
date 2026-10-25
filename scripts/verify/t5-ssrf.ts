/** T5：SSRF 防护——协议白名单、私网拒绝、DNS 私网拒绝、本地授权放行 */
import { assertUrlAllowed, isPrivateIp } from "../../src/lib/llm/ssrf";

export async function run(): Promise<{ status: "pass" | "fail" | "skip"; detail: string }> {
  const results: string[] = [];
  let fail = 0;

  async function expectReject(url: string, allowLocal: boolean, label: string) {
    try {
      await assertUrlAllowed(url, allowLocal);
      results.push(`✗ ${label} 未被拒绝`);
      fail += 1;
    } catch {
      results.push(`✓ ${label} 已拒绝`);
    }
  }

  if (!isPrivateIp("127.0.0.1") || !isPrivateIp("10.1.2.3") || !isPrivateIp("192.168.0.9") || !isPrivateIp("::1")) {
    results.push("✗ isPrivateIp 漏判私网");
    fail += 1;
  }
  await expectReject("ftp://example.com", false, "ftp 协议");
  await expectReject("http://127.0.0.1:8080", false, "环回地址");
  await expectReject("http://192.168.1.1", false, "私网 IP");
  await expectReject("http://localhost:11434", false, "localhost（未授权本地）");
  try {
    await assertUrlAllowed("http://127.0.0.1:11434", true);
    results.push("✓ 本地模型授权后放行 127.0.0.1");
  } catch {
    results.push("✗ 本地模型授权后仍被拒绝");
    fail += 1;
  }
  try {
    await assertUrlAllowed("https://registry.npmmirror.com", false);
    results.push("✓ 公网域名放行（DNS 在线）");
  } catch (e) {
    results.push(`△ 公网域名校验失败（可能离线）：${e instanceof Error ? e.message : e}`);
  }

  return fail === 0
    ? { status: "pass", detail: results.join("；") }
    : { status: "fail", detail: results.join("；") };
}
