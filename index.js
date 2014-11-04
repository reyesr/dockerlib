var shell = require('shelljs');

function runDocker(args) {
    var cmdline = "docker " + args;
    if (exports.extraVerbose) {
        console.log("exec: " + cmdline);
    }
    if (exports.sudo) {
        cmdline = "sudo " + cmdline;
    }
    var result = shell.exec(cmdline, {silent:(!exports.verbose||exports.sudo)});
    if (result.code !== 0) {
        if (exports.verbose) {
            console.log(result.output);
        }
        throw new Error("Command [" + cmdline + "] returned code " + result.code);
    }
}

function quote(arg) {
    return "'" + arg + "'";
}

function joinVersion(imageName, version) {
    if (typeof version == "string" && version.length>0) {
        return imageName + ":" + version;
    }
    return imageName;
}

function getUserHome() {
  return process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
}

function interpolate(str, data) {
    return str.replace(/\$([a-zA-Z0-9]+)/g,
        function (a, b) {
            var r = data[b.toLowerCase()];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        }
    );
};

exports.enableVolumeInterpolation = true;
exports.verbose = false;
exports.extraVerbose = false;
exports.sudo = false;
exports.joinVersion = joinVersion;

exports.docker = {
    login: function(userName, server) {
        exports.extraVerbose && console.log("Loging to registry " + quote(server) + " as " + quote(userName));
        runDocker(["login", "-u", quote(userName), (server!==undefined?(" " + quote(server)):"")].join(" "))
    },

    tagRemoteName: function(imageName, remoteImageName, version) {
        var local = joinVersion(imageName, version);
        var remote = joinVersion(remoteImageName, version);
        exports.extraVerbose && console.log("tagging " + quote(local) + " as " + quote(remote));
        runDocker("tag " + quote(local) + " " + quote(remote));
        return remote;
    },

    tag: function(imageName, tag) {
        var fullName = joinVersion(imageName, tag);
        exports.extraVerbose && console.log("tagging " + quote(imageName) + " as " + quote(fullName));
        runDocker("tag " + quote(imageName) + " " + quote(fullName));
        return fullName;
    },

    push: function(tag) {
        exports.extraVerbose && console.log("pushing " + quote(tag));
        runDocker("push " + quote(tag));
    },

    pull: function(image, tag) {
        var fullName = joinVersion(image, tag);
        exports.extraVerbose && console.log("pulling " + quote(fullName));
        runDocker("pull " + quote(fullName));
    },

    removeContainer: function(containerName) {
        exports.extraVerbose && console.log("removing container " + quote(containerName));
        runDocker("rm -f " + quote(containerName));
    },

    runDaemon: function(containerName, containerImage, versionTag, ports, links, volumes, runOpts) {
        var cmdline = "run -d --restart=always";
        if (ports) {
            cmdline += [].concat(ports).map(function(p) {
                return " -p " + p;
            }).join(" ");
        }
        if (links) {
            cmdline += [].concat(links).map(function(p) {
                return " --link " + p;
            }).join(" ");
        }
        if (volumes) {
            cmdline += [].concat(volumes).map(function(volume) {
                vol = exports.enableVolumeInterpolation?interpolate(volume, {home: getUserHome()}):volume;
                var volsplit = vol.split(":");
                if (volsplit.length>1 && !shell.test("-d", volsplit[0])) {
                    throw new Error("Local volume path '" + volsplit[0] + "' does not exist (" + volume + ")")
                }
                return " -v " + vol;
            }).join(" ");
        }
        if (typeof runOpts == "string") {
            cmdline += " " + runOpts;
        }
        cmdline += " --name " + containerName;
        cmdline += " " + joinVersion(containerImage, versionTag);

        runDocker(cmdline);
    },

    kill: function(containerName) {
        runDocker("rm -f " + containerName);
    }
};