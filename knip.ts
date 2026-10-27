import type { KnipConfig } from "knip";

const production = process.argv.includes("--production");

const config: KnipConfig = {
  // Entries come from package.json (main, the test script and jest); only the project files are set.
  // `!` marks the files that ship: the production run leaves out tests and devDependencies.
  project: ["src/**/*.ts!", "test/**/*.ts"],
  // Only for --production: an export used just inside its own file is dead there, but a test may
  // import it in the default run.
  ignoreExportsUsedInFile: production,
  // knip reports cycles as warnings by default, which do not fail the run.
  rules: { cycles: "error" },
  include: [
    "files",
    "dependencies",
    "unlisted",
    "binaries",
    "unresolved",
    "exports",
    "types",
    "nsTypes",
    "enumMembers",
    "namespaceMembers",
    "duplicates",
    "cycles",
  ],
};

export default config;
