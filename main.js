const {
    echo, find, exec
} = require('shelljs');

const colors = require('colors');
const filewatcher = require('filewatcher');
const ProgressBar = require('ascii-progress')

const watcher = new filewatcher();

const opn = require('opn');
const express = require('express');

const srcDir = '/Users/Teamwork/Teamwork/project-manager/tko/src/app/helpers';

// Folders and files to exclude
const excludes = [
    'node_modules/',
    'libs/',
    'gulpfile.coffee',
    'build/',
];

// Global variables we can ignore
const globals = [
    'require',
    'define',
    'console',
    'alert',
    'app',
    'escape',
    'unescape'
];

echo('Checking Undefined Variables'.yellow);
echo('Grab a coffee, sit back... this may take a while.'.white);

const state = {
    total: 0,
    total_unique: 0,
    names: {},
}

const output = {
    stats: {
        total: 0,
        total_unique: 0,
        names: {},
    },
    files: {},
};
const unique = {};



const formatStats = (output, { name, file, line }) => {
    let newOutput = Object.assign({}, output);

    state.total++;
    state.names[name] = state.names[name] || [];
    newOutput.files[file] = newOutput.files[file] || []


    if (!state.names[name].includes(file)) {
        state.names[name].push(file);
    }
    if (!newOutput.files[file].includes(line)) {
        newOutput.files[file].push(line);
    }

    return newOutput;
}

const coffeeJSHint = (file, watched) => {
    // run coffee-jshint cli
    let hasErrors = false;
    let {
        stdout, stderr, code
    } = exec(`coffee-jshint ${file} --default-options-off --options undef,browser --globals ${globals.join(',')}`,
            { silent: true }
        );

    if (stderr) {
        echo(`${stderr}`.red)
    }

    bar.tick()
    let lines = stdout.split('\n');

    watcher.add(file);
    delete output.files[file]

    let names = [];
    lines.forEach(line => {
        if (line.includes('is not defined')) {
            hasErrors = true

            let name = line.match(/'([^']+)'/)[1];

            if (!names.includes(name)) {
                names.push(name);
            }

            Object.assign(output, formatStats(output, { name, file, line }));
        }
    });

    if (!hasErrors) {
        names.forEach(name => {
            state.names[name] = state.names[name].filter(item => item !== file);
        })

        if (output.files[file]) {
            delete output.files[file]
            echo(`Fixed: ${file}`.green);
        }
        return
    }
    if (watched) {
        echo(`Error: ${file}`.red);
    }
}

const writeStats = (output) => {

    output.stats.names = state.names;
    output.stats.total = state.total;
    output.stats.total_unique = output.stats.names.length;
}


// add watcher to dirctory
watcher.on('change', function (file, stat) {
    coffeeJSHint(file, true);
    writeStats(output);
    sendUpdate('file', { file })
});

const files = find(srcDir).filter(function (file) {
    if (excludes.some(dir => file.includes(dir))) {
        return false;
    }
    return file.match(/\.coffee?$/i);
})

const bar = new ProgressBar({
    schema: ':bar :current/:total :percent :elapseds :etas',
    total: files.length
});

files.forEach(file => coffeeJSHint(file, false));

writeStats(output);
echo(`${state.total} errors in ${files.length} files`.red)

// now lets set up the server for the results

const http = require('http');
const path = require("path");
const app = express()

const server = http.createServer(app);

const io = require('socket.io')(server)

app.use('/', express.static(path.join(__dirname, 'public')))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/index.html'));
})
app.get('/stats', (req, res) => {
    res.json(output);
})

const sendUpdate = (type, data) => {
    io.emit(type, data);
}

server.listen(3000)
opn('http://localhost:3000')