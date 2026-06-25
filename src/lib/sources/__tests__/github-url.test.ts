import { describe, it, expect } from "vitest";
import { parseGitHubUrl, GitHubUrlError } from "@/lib/sources/github-url";

describe("parseGitHubUrl", () => {
  describe("valid URLs", () => {
    it("parses standard HTTPS URL", () => {
      const result = parseGitHubUrl("https://github.com/vercel/next.js");
      expect(result.owner).toBe("vercel");
      expect(result.repo).toBe("next.js");
      expect(result.url).toBe("https://github.com/vercel/next.js");
    });

    it("parses HTTPS URL with trailing .git", () => {
      const result = parseGitHubUrl("https://github.com/facebook/react.git");
      expect(result.owner).toBe("facebook");
      expect(result.repo).toBe("react");
    });

    it("parses HTTPS URL with trailing slash", () => {
      const result = parseGitHubUrl("https://github.com/microsoft/vscode/");
      expect(result.owner).toBe("microsoft");
      expect(result.repo).toBe("vscode");
    });

    it("parses HTTPS URL with extra path segments (tree/main)", () => {
      const result = parseGitHubUrl("https://github.com/vercel/next.js/tree/main");
      expect(result.owner).toBe("vercel");
      expect(result.repo).toBe("next.js");
    });

    it("parses HTTPS URL with issues path", () => {
      const result = parseGitHubUrl("https://github.com/vercel/next.js/issues");
      expect(result.owner).toBe("vercel");
      expect(result.repo).toBe("next.js");
    });

    it("parses SSH URL (git@ format)", () => {
      const result = parseGitHubUrl("git@github.com:owner/repo.git");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    it("parses git:// protocol URL", () => {
      const result = parseGitHubUrl("git://github.com/owner/repo.git");
      expect(result.owner).toBe("owner");
      expect(result.repo).toBe("repo");
    });

    it("parses shorthand owner/repo", () => {
      const result = parseGitHubUrl("vercel/next.js");
      expect(result.owner).toBe("vercel");
      expect(result.repo).toBe("next.js");
    });

    it("parses URL without protocol (auto-prepends https)", () => {
      const result = parseGitHubUrl("github.com/vercel/next.js");
      expect(result.owner).toBe("vercel");
      expect(result.repo).toBe("next.js");
    });

    it("parses URL with www. prefix", () => {
      const result = parseGitHubUrl("https://www.github.com/vercel/next.js");
      expect(result.owner).toBe("vercel");
      expect(result.repo).toBe("next.js");
    });

    it("handles repo names with dots and hyphens", () => {
      const result = parseGitHubUrl("https://github.com/user/my.repo-name");
      expect(result.owner).toBe("user");
      expect(result.repo).toBe("my.repo-name");
    });

    it("strips query parameters", () => {
      const result = parseGitHubUrl("https://github.com/vercel/next.js?tab=readme");
      expect(result.owner).toBe("vercel");
      expect(result.repo).toBe("next.js");
    });

    it("strips fragment", () => {
      const result = parseGitHubUrl("https://github.com/vercel/next.js#readme");
      expect(result.owner).toBe("vercel");
      expect(result.repo).toBe("next.js");
    });
  });

  describe("invalid inputs", () => {
    it("throws on empty string", () => {
      expect(() => parseGitHubUrl("")).toThrow(GitHubUrlError);
      expect(() => parseGitHubUrl("  ")).toThrow(GitHubUrlError);
    });

    it("throws on non-GitHub URL", () => {
      expect(() => parseGitHubUrl("https://gitlab.com/owner/repo")).toThrow(
        GitHubUrlError
      );
    });

    it("throws on URL with no repo path", () => {
      expect(() => parseGitHubUrl("https://github.com/vercel")).toThrow(
        GitHubUrlError
      );
    });

    it("throws on garbage input", () => {
      expect(() => parseGitHubUrl("not a url at all")).toThrow(GitHubUrlError);
    });

    it("throws on owner with leading hyphen", () => {
      expect(() => parseGitHubUrl("-invalid/repo")).toThrow(GitHubUrlError);
    });

    it("throws on owner with special characters", () => {
      expect(() => parseGitHubUrl("inva lid/repo")).toThrow(GitHubUrlError);
    });

    it("throws on repo name with spaces", () => {
      expect(() => parseGitHubUrl("owner/repo name")).toThrow(GitHubUrlError);
    });

    it("throws on shorthand with too many slashes", () => {
      expect(() => parseGitHubUrl("owner/repo/extra")).toThrow(GitHubUrlError);
    });
  });

  describe("normalized URL output", () => {
    it("always returns a clean https URL", () => {
      const ssh = parseGitHubUrl("git@github.com:vercel/next.js.git");
      expect(ssh.url).toBe("https://github.com/vercel/next.js");

      const shorthand = parseGitHubUrl("vercel/next.js");
      expect(shorthand.url).toBe("https://github.com/vercel/next.js");
    });
  });
});
