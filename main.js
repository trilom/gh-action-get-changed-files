"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// External Dependencies
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
const gh = __importStar(require("@actions/github"));
class ChangedFiles {
    constructor() {
        this.updated = [];
        this.created = [];
        this.deleted = [];
        this.files = [];
    }
}
function sortChangedFiles(files) {
    return __awaiter(this, void 0, void 0, function* () {
        return files.reduce((acc, f) => {
            if (f.status === "added" || f.added) {
                acc.created.push(f.filename === undefined ? f.added : f.filename);
                acc.files.push(f.filename === undefined ? f.added : f.filename);
            }
            if (f.status === "removed" || f.removed) {
                acc.deleted.push(f.filename === undefined ? f.removed : f.filename);
            }
            if (f.status === "modified" || f.modified) {
                acc.updated.push(f.filename === undefined ? f.modified : f.filename);
                acc.files.push(f.filename === undefined ? f.modified : f.filename);
            }
            if (f.status === "renamed") {
                acc.created.push(f.filename);
                acc.deleted.push(f["previous_filename"]);
            }
            return acc;
        }, new ChangedFiles());
    });
}
function getChangedPRFiles(client, prNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield client.pulls.listFiles({
            owner: gh.context.repo.owner,
            repo: gh.context.repo.repo,
            pull_number: prNumber,
        });
        return sortChangedFiles(response.data);
    });
}
function getChangedPushFiles(commits) {
    return __awaiter(this, void 0, void 0, function* () {
        const distinctCommits = commits.filter(c => c.distinct);
        return sortChangedFiles(distinctCommits);
    });
}
function getPrNumber() {
    const pr = gh.context.payload.pull_request;
    return pr ? pr.number : null;
}
// figure out if it is a PR or Push
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput("repo-token");
            const client = new gh.GitHub(token);
            const eventName = gh.context.eventName;
            let changedFiles = new ChangedFiles();
            if (eventName == "push") {
                // do push actions
                changedFiles = yield getChangedPushFiles(gh.event.commits);
            }
            else if (eventName == "pullRequest") {
                // do PR actions
                const prNumber = getPrNumber();
                if (prNumber != null) {
                    changedFiles = yield getChangedPRFiles(client, prNumber);
                }
                else {
                    core.setFailed("Could not get pull request number from context, exiting");
                    return;
                }
            }
            else {
                core.setFailed(`Change not initiated by a PR or Push, it was ${eventName} instead.`);
                return;
            }
            //write files to preserve original functionality
            fs.writeFileSync(`${process.env.HOME}/files.json`, JSON.stringify(changedFiles.files), "utf-8");
            fs.writeFileSync(`${process.env.HOME}/files_modified.json`, JSON.stringify(changedFiles.updated), "utf-8");
            fs.writeFileSync(`${process.env.HOME}/files_added.json`, JSON.stringify(changedFiles.created), "utf-8");
            fs.writeFileSync(`${process.env.HOME}/files_deleted.json`, JSON.stringify(changedFiles.deleted), "utf-8");
            //also export some outputs
            core.setOutput("files_created", changedFiles.created.join(" "));
            core.setOutput("files_updated", changedFiles.updated.join(" "));
            core.setOutput("files_deleted", changedFiles.deleted.join(" "));
            process.exit(0);
        }
        catch (error) {
            core.error(error);
            core.setFailed(error.message);
        }
    });
}
run();
