import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import {
  DATA_DIR_ENV_KEY,
  getDataDir,
  getProjectRoot,
} from "@packages/shared/config";

const originalDataDirEnv = process.env[DATA_DIR_ENV_KEY];

beforeEach(() => {
  delete process.env[DATA_DIR_ENV_KEY];
});

after(() => {
  if (typeof originalDataDirEnv === "undefined") {
    delete process.env[DATA_DIR_ENV_KEY];
    return;
  }
  process.env[DATA_DIR_ENV_KEY] = originalDataDirEnv;
});

describe("getDataDir", () => {
  it("default value should be project root path", () => {
    assert.equal(getDataDir(), getProjectRoot());
  });

  it("should use absolute path environment variable value as is", () => {
    const absolutePath = "/tmp/pabal-mcp-data";
    process.env[DATA_DIR_ENV_KEY] = absolutePath;

    assert.equal(getDataDir(), absolutePath);
  });

  it("should interpret relative path environment variable value relative to project root", () => {
    process.env[DATA_DIR_ENV_KEY] = "./tmp/data";
    const expected = resolve(getProjectRoot(), "tmp/data");

    assert.equal(getDataDir(), expected);
  });
});
