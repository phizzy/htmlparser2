
var emptyTags = {
	"area": 1
	,"base": 1
	,"basefont": 1
	,"br": 1
	,"col": 1
	,"frame": 1
	,"hr": 1
	,"img": 1
	,"input": 1
	,"isindex": 1
	,"link": 1
	,"meta": 1
	,"param": 1
	,"embed": 1
	,"?xml": 1
};

var ampRe = /&/g,
looseAmpRe = /&([^a-z#]|#(?:[^0-9x]|x(?:[^0-9a-f]|$)|$)|$)/gi,
ltRe = /</g,
gtRe = />/g,
quotRe = /\"/g,
eqRe = /\=/g;

function escapeAttrib(s) {
	// null or undefined
	if (s == null) {
		return '';
	}
	if (s.toString && typeof s.toString == 'function') {
		// Escaping '=' defangs many UTF-7 and SGML short-tag attacks.
		return s.toString().replace(ampRe, '&amp;').replace(ltRe, '&lt;').replace(gtRe, '&gt;').replace(quotRe, '&#34;').replace(eqRe, '&#61;');
	} else {
		return '';
	}
}

var isEmpty = function(obj) {
    if (obj==null) return true;
    if (obj.length) return false;
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    };
    return true;
};

function html(item, parent, eachFn) {
	// apply recursively to arrays
	if (Array.isArray(item)) {
		return item.map(function(subitem) {
			// parent, not item: the parent of an array item is not the array,
			// but rather the element that contained the array
			return html(subitem, parent, eachFn);
		}).join('');
	}
	var orig = item;
	if (eachFn) {
		item = eachFn(item, parent);
	}
	if (typeof item != 'undefined' && typeof item.type != 'undefined') {
		switch (item.type) {
			case 'text':
				return item.data;
			case 'directive':
				return '<' + item.data + '>';
			case 'comment':
				return '<!--' + item.data + '-->';
			case 'style':
			case 'script':
			case 'tag':
                var tmpHandlerName = item.name;
                var result = '';
                if (typeof(handler[tmpHandlerName])==='function') {
                    result = handler[tmpHandlerName](item, eachFn);
                }
                else {
                    result = '<' + item.name;
                    if (item.attribs && Object.keys(item.attribs).length > 0) {
                        result += ' ' + Object.keys(item.attribs).map(function(key) {
                            return key + '="' + escapeAttrib(item.attribs[key]) + '"';
                        }).join(' ');
                    }
                    if (item.children) {
                        // parent becomes the current element
                        // check if the current item (before any eachFns are run) - is a renderable
                        if (!orig.render) {
                            orig = parent;
                        }
                        result += '>' + html(item.children, orig, eachFn) + (emptyTags[item.name] ? '': '</' + item.name + '>');
                    } else {
                        if (emptyTags[item.name]) {
                            result += '>';
                        } else {
                            result += '></' + item.name + '>';
                        }
                    }
                }
				return result;
			case 'cdata':
				return '<!CDATA[' + item.data + ']]>';
		}
	}
	return item;
}

var fileRootPath = [];
function html2html(file, eachFn) {
    if (isEmpty(fileRootPath)) {
        fileRootPath.push(process.cwd());
    }
    var latestPath = fileRootPath[fileRootPath.length-1];
    var path = require('path');
    file = path.normalize(latestPath + '/' + file);
    var crtPath = path.dirname(file);
    if (latestPath!==crtPath) {
        fileRootPath.push(crtPath);
    };

    var result = '';
    try {
        var fs = require('fs');
        //TODO 异步方式处理
        var rawHTML = fs.readFileSync(file, {encoding: 'utf-8'});
        var htmlparser = require('htmlparser2');
        var json = htmlparser.parseDOM(rawHTML);
        result = html(json, undefined, eachFn);
    }
    catch (e) {
        console.error(e.message);
    }
    fileRootPath.pop();
    return result;
};

var handler = {
    include: function(item, eachFn) {
        var mycontent = '';
        var mychildren = html(item.children, item, eachFn);
        if (!isEmpty(item.attribs)) {
            mycontent = html2html(item.attribs.file, eachFn);
        }
        return mycontent + mychildren;
    }
};

module.exports = html2html;

