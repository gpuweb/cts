/* eslint no-process-exit: "off" */

function node() {
  const { existsSync } = require("fs");

  return {
    type: "node",
    existsSync,
    args: process.argv.slice(2),
    cwd: process.cwd,
    exit: process.exit,
  };
}

function deno() {
  function existsSync(path: string) {
    try {
      // @ts-ignore
      Deno.readFileSync(path);
      return true;
    } catch (err) {
      return false;
    }
  }

  return {
    type: "deno",
    existsSync,
    // @ts-ignore
    args: Deno.args,
    // @ts-ignore
    cwd: Deno.cwd,
    // @ts-ignore
    exit: Deno.exit as (rc: number) => never,
  };
}

const sys = (typeof globalThis.process !== "undefined" ? node() : deno());

export default sys;
