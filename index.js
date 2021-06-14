const { getAllFilePathsWithExtension, readFile } = require('./fileSystem');
const { readLine } = require('./console');
const { FILE } = require('dns');
const { runInThisContext } = require('vm');

app();

function app () {
    const files = getFiles();

    console.log('Please, write your command!');
    readLine((command) => processCommand(command, files));
}

function getFiles () {
    const filePaths = getAllFilePathsWithExtension(process.cwd(), 'js');
    return filePaths.map(path => {
        let file = {};
        let filename_regexp = /\/[\w\d]*\.js/;
        file.name = String(path.match(filename_regexp)).slice(1);
        file.text = readFile(path);
        return file;
    });
}

function parseComments (files_list) {
    let comment_parse_regexp = /\/\/ TODO\s*?:?\s?([^\n]*?;)?\s?(\d{4}-\d{2}-\d{2};|;?)\s?([^\n]*?)$/igm;
    let comments = [];

    for (let file of files_list){

        let parsed_comment = comment_parse_regexp.exec(file.text);
        if (parsed_comment){
            do {
                let comment = {
                    importance: ' ',
                    user: ' ',
                    date: ' ',
                    text: ' ',
                    filename: file.name,
                };
                comment.user = parsed_comment[1]? (parsed_comment[1].slice(0, -1)? parsed_comment[1].slice(0, -1):' '):' ';
                comment.date = parsed_comment[2]? (parsed_comment[2].slice(0, -1)? parsed_comment[2].slice(0, -1):' '):' ';
                comment.text = parsed_comment[3];
                comment.importance = comment.text.match(/!/)? '!':' ';
                
                comments.push(comment);
                
                parsed_comment = comment_parse_regexp.exec(file.text);
            } while (parsed_comment)
        }
    }
    return comments;
}

class Table {
    constructor(comments) {
        this.comments = comments;
        this.col_lengths = this.adjustCols();
    }

    adjustCols() {
        let col_lengths = {
            importance: 1,
            user: 'user'.length, // max - 10
            date: 'date'.length, // max - 10
            text: 'comment'.length, // max - 50
            filename: 'filename'.length // max - 15
        };
        for (let comment of this.comments) {
            for (let key in col_lengths) {
                let current_length = col_lengths[key];
                let new_length = comment[key].length;
                col_lengths[key] = (current_length > new_length)? current_length : new_length;
            }
        }
        col_lengths.user = (col_lengths.user > 10)? 10 : col_lengths.user;
        col_lengths.date = (col_lengths.date > 10)? 10 : col_lengths.date;
        col_lengths.text = (col_lengths.text > 50)? 50 : col_lengths.text;
        col_lengths.filename = (col_lengths.filename > 15)? 15 : col_lengths.filename;
        return col_lengths;
    }

    stringify(comment) {
        let string = '';
        for (let key in comment) {
            let spaces_num = this.col_lengths[key] - comment[key].length;
            if (string) {
                string += '|';
            }
            if (spaces_num < 0) {
                string += '  ' + comment[key].slice(0, spaces_num - 3) + '...' + '  ';
            } else {
                string += '  ' + comment[key] + ' '.repeat(spaces_num) + '  ';
            }
        }
        string += '\n';
        return string;
    }

    filtered(col, condition, value) {
        let filtered_comments = [];

        for (let comment of this.comments) {
            if (condition(comment[col], value)){
                filtered_comments.push(comment);
            }
        }
        
        return new Table(filtered_comments);
    }

    sorted(type) {
        let sorted_comments = this.comments.slice(0);
        switch (type){
            case 'importance':
                sorted_comments.sort((comment, next_comment) => {
                    let comment_importance = comment.text.match(/!+/)? comment.text.match(/!+/)[0].length : 0;
                    let next_comment_importance = next_comment.text.match(/!+/)? next_comment.text.match(/!+/)[0].length : 0;
                    if (comment_importance > next_comment_importance) return -1;
                    else {
                        if (comment_importance < next_comment_importance) return 1; 
                        else return 0;
                    }
                });
                break;
            case 'user':
                sorted_comments.sort((comment, next_comment) => {
                    if (comment.user == ' '){
                        if (next_comment.user == ' ') return 0;
                        return 1;
                    } else if (next_comment.user == ' ') return -1;

                    if (comment.user.toLowerCase() < next_comment.user.toLowerCase()) return -1;
                    else if (comment.user.toLowerCase() > next_comment.user.toLowerCase()) return 1;
                    return 0;
                });
                break;
            case 'date':
                sorted_comments.sort((comment, next_comment) => {
                    if (comment.date == ' '){
                        if (next_comment.date == ' ') return 0;
                        return 1;
                    } else if (next_comment.date == ' ') return -1;

                    let date = new Date(comment.date);
                    let next_date = new Date(next_comment.date);
                    if (date > next_date) return -1;
                    else if (date < next_date) return 1;
                    return 0;
                });
                break;
            default:
                console.log('wrong command');
                break;
        }

        return new Table(sorted_comments);
    }

    print() {
        let table = '';
        let header = {
            importance: '!',
            user: 'user',
            date: 'date',
            text: 'comment',
            filename: 'fileName'
        };
        
        table += this.stringify(header);
        let table_width = table.length;
        table += '-'.repeat(table_width - 1) + '\n';
        for (let comment of this.comments) {
            table += this.stringify(comment);
        }
        table += '-'.repeat(table_width - 1) + '\n';
        console.log(table);
    }
}

function stringContains(string, value) {
    let reg = RegExp('^' + value, 'i');
    if (string.match(reg)) {
        return true;
    } else return false;
}

function afterDate(date_string, date_for_comparison) {
    if (new Date(date_for_comparison) <= new Date(date_string)) {
        return true;
    } else return false;
}


function processCommand (command, files_list) {
    comments = parseComments(files_list);
    let command_name = ' ';
    let command_attributes = undefined;    
    if (command){
        let command_regexp = /^(\w*?[^\s])$|^([^]*?)\s([^]*?)$/;
        command_attributes = command_regexp.exec(command);
        command_name = command_attributes[1]? command_attributes[1]:command_attributes[2];
    }
    let table = new Table(comments);
    switch (command_name) {
        case 'exit':
            process.exit(0);
            break;
        case 'show':
            table.print();
            break;
        case 'important':
            table.filtered('importance', stringContains, '!').print();
            break;
        case 'user':
            table.filtered('user', stringContains, command_attributes[3]).print();
            break;
        case 'sort':
            if(command_attributes[3]){
                if (command_attributes[3].match(/^importance$|^user$|^date$/i)){
                    table.sorted(command_attributes[3]).print();
                }
            } else {
                console.log('wrong command');
                break;
            }
            break;
        case 'date':
            if(command_attributes[1]){
                console.log('wrong command');
                break;
            }else if (command_attributes[3].match(/^\d*?$/)){
                table.filtered('date', afterDate, command_attributes[3]).print();
                break;
            } else {
                console.log('wrong command');
                break;
            }
        default:
            console.log('wrong command');
            break;
    }
}

// you can do it!