(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* This file contains a module for functions that make calls to the API and their associated
   helper functions.
 */
var utils = require('./utils');
/* Listener functions for the API calls; since downloads have a non-JSON response, they need a
   separate listener.
 */
var JSONListener = function (component, resp) {
    var response = resp.responseText;
    if (resp.status !== 200) {
        component.setState({ responseText: utils.errorHandler(resp.status, response) });
    }
    else {
        component.setState({ responseText: utils.prettyJson(response) });
    }
};
var DownloadCallListener = function (component, resp, path) {
    if (resp.status !== 200) {
        component.setState({ responseText: utils.errorHandler(resp.status, utils.arrayBufToString(resp.response))
        });
    }
    else {
        var response = resp.getResponseHeader('rinocloud-api-result');
        component.setState({ responseText: utils.prettyJson(response) });
        var toDownload = new Blob([resp.response], { type: 'multipart/form-data' });
        component.setState({
            downloadURL: URL.createObjectURL(toDownload),
            downloadFilename: JSON.parse(response).name
        });
    }
};
/* Utility for determining the correct callback function given an endpoint's kind
   Since the download listener needs to know the filename (for saving the file), it's
   passed through this function.
 */
exports.chooseCallback = function (k, path) {
    switch (k) {
        case utils.EndpointKind.Download:
            return function (component, resp) {
                return DownloadCallListener(component, resp, path);
            };
        default: return JSONListener;
    }
};
var initRequest = function (endpt, headers, listener, component) {
    var request = new XMLHttpRequest();
    request.onload = function (_) { return listener(component, request); };
    request.open('POST', endpt.getURL(), true);
    request.setRequestHeader('Access-Control-Allow-Headers', 'X-Requested-With,rinocloud-api-result');
    request.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    request.setRequestHeader('rinocloud-api-result', '*');
    for (var key in headers) {
        request.setRequestHeader(key, headers[key]);
    }
    return request;
};
var beginRequest = function (component) {
    component.setState({ inProgress: true });
    component.setState({ hideResponse: true });
};
var endRequest = function (component) {
    component.setState({ inProgress: false });
    component.setState({ hideResponse: false });
};
/* This function actually makes the API call. There are three different paths, based on whether
   the endpoint is upload-like, download-like, or RPC-like.
   The file parameter will be null unless the user specified a file on an upload-like endpoint.
 */
exports.APIWrapper = function (data, endpt, token, listener, component, file) {
    beginRequest(component);
    var listener_wrapper = function (component, resp) {
        endRequest(component);
        listener(component, resp);
    };
    switch (endpt.kind) {
        case utils.EndpointKind.RPCLike:
            var request = initRequest(endpt, utils.RPCLikeHeaders(token), listener_wrapper, component);
            request.send(data);
            break;
        case utils.EndpointKind.Upload:
            var request = initRequest(endpt, utils.uploadLikeHeaders(token, data), listener_wrapper, component);
            if (file !== null) {
                var formData = new FormData();
                formData.append("file", file);
                formData.append("json", data);
                request.send(formData);
            }
            else {
                request.send();
            }
            break;
        case utils.EndpointKind.Download:
            var win = window.open(endpt.getURL() + '?id=' + JSON.parse(data).id, '_blank');
            win.focus();
            endRequest(component);
            break;
    }
};

},{"./utils":6}],2:[function(require,module,exports){
(function (global){
/* The functions that handle the code view part of the interface: taking the input and
   representing it as an HTTP request or code to generate that request.
 */
var react = (typeof window !== "undefined" ? window['React'] : typeof global !== "undefined" ? global['React'] : null);
var utils = require('./utils');
var ce = react.createElement;
var d = react.DOM;
var syntaxHighlight = function (syntax, text) {
    return ce(utils.Highlight, { className: syntax }, text);
};
// Applies f to each element of the dict, and then appends the separator to all but the last result.
// Subsequent list elements are separated by newlines.
var joinWithNewlines = function (dc, f, sep) {
    if (sep === void 0) { sep = ','; }
    return utils.Dict._map(dc, function (k, v, i) {
        var maybeSep = (i === Object.keys(dc).length - 1) ?
            "\n" : sep + "\n";
        return d.span({ key: "" + i }, f(k, v), maybeSep);
    });
};
// the minor differences between JSON and Python's notation
var pythonStringify = function (val) {
    if (val === true) {
        return "True";
    }
    else if (val === false) {
        return "False";
    }
    else if (val === null || (val !== val)) {
        return "None";
    }
    else {
        return JSON.stringify(val);
    }
};
// Representation of a dict, or null if the passed-in dict is also null
var dictToPython = function (name, dc) { return d.span(null, name + ' = ', (dc === null) ?
    'None' : d.span(null, '{\n', joinWithNewlines(dc, function (k, v) { return '    "' + k + '": ' + pythonStringify(v); }), '}'), '\n\n'); };
// For curl calls, we need to escape single quotes, and sometimes also double quotes.
var shellEscape = function (val, inQuotes) {
    if (inQuotes === void 0) { inQuotes = false; }
    var toReturn = JSON.stringify(val).replace(/'/g, "'\\''");
    if (inQuotes)
        return toReturn.replace(/\\/g, '\\\\').replace(/"/g, '\\\"');
    else
        return toReturn;
};
// Generates the functions that make up the Python Requests code viewer
var RequestsCodeViewer = function () {
    var syntax = "python";
    // common among all three parts
    var preamble = function (endpt) { return d.span(null, 'import requests\n', 'import json\n\n', 'url = "' + endpt.getURL() + '"\n\n'); };
    var requestsTemplate = function (endpt, headers, dataReader, call) {
        return syntaxHighlight(syntax, d.span(null, preamble(endpt), dictToPython('headers', headers), dataReader, call));
    };
    var requestsRPCLike = function (endpt, token, paramVals) {
        return requestsTemplate(endpt, utils.RPCLikeHeaders(token), dictToPython('data', paramVals), 'r = requests.post(url, headers=headers, data=json.dumps(data))');
    };
    var requestsUploadLike = function (endpt, token, paramVals, file) {
        return requestsTemplate(endpt, utils.uploadLikeHeaders(token, JSON.stringify(paramVals)), 'data = open(' + JSON.stringify(file.name) + ', "rb").read()\n\n', 'r = requests.post(url, headers=headers, data=data)');
    };
    var requestsDownloadLike = function (endpt, token, paramVals) {
        return requestsTemplate(endpt, utils.getHeaders(endpt, token, JSON.stringify(paramVals)), '', 'r = requests.post(url, headers=headers)');
    };
    return {
        syntax: syntax,
        description: "Python request (requests library)",
        renderRPCLike: requestsRPCLike,
        renderUploadLike: requestsUploadLike,
        renderDownloadLike: requestsDownloadLike
    };
};
// Python's httplib library (which is also the urllib backend)
var HttplibCodeViewer = function () {
    var syntax = "python";
    var preamble = d.span(null, 'import sys\nimport json\n', 'if (3,0) <= sys.version_info < (4,0):\n', '    import http.client as httplib\n', 'elif (2,6) <= sys.version_info < (3,0):\n', '    import httplib\n\n');
    var httplibTemplate = function (endpt, headers, dataReader, dataArg) {
        return syntaxHighlight(syntax, d.span(null, preamble, dictToPython('headers', headers), dataReader, 'c = httplib.HTTPSConnection("' + endpt.getHostname() + '")\n', 'c.request("POST", "' + endpt.getPathname() + '", ' + dataArg + ', headers)\n', 'r = c.getresponse()'));
    };
    var httplibRPCLike = function (endpt, token, paramVals) {
        return httplibTemplate(endpt, utils.RPCLikeHeaders(token), dictToPython('params', paramVals), 'json.dumps(params)');
    };
    var httplibUploadLike = function (endpt, token, paramVals, file) {
        return httplibTemplate(endpt, utils.uploadLikeHeaders(token, JSON.stringify(paramVals)), 'data = open(' + JSON.stringify(file.name) + ', "rb")\n\n', 'data');
    };
    var httplibDownloadLike = function (endpt, token, paramVals) {
        return httplibTemplate(endpt, utils.getHeaders(endpt, token, JSON.stringify(paramVals)), '', '""');
    };
    return {
        syntax: syntax,
        description: "Python request (standard library)",
        renderRPCLike: httplibRPCLike,
        renderUploadLike: httplibUploadLike,
        renderDownloadLike: httplibDownloadLike
    };
};
var CurlCodeViewer = function () {
    var syntax = 'bash';
    var urlArea = function (endpt) { return 'curl -X POST ' + endpt.getURL() + ' \\\n'; };
    var makeHeaders = function (headers) { return d.span(null, utils.Dict._map(headers, function (k, v, i) {
        var sep = '\\\n';
        if (i == Object.keys(headers).length - 1)
            sep = '';
        return d.span({ key: "" + i }, "  --header '" + k + ': ' + v + "' " + sep);
    })); };
    // The general model of the curl call, populated with the arguments.
    var curlTemplate = function (endpt, headers, data) {
        return syntaxHighlight(syntax, d.span(null, urlArea(endpt), makeHeaders(headers), data));
    };
    var curlRPCLike = function (endpt, token, paramVals) {
        return curlTemplate(endpt, utils.RPCLikeHeaders(token), "\\\n  --data '" + shellEscape(paramVals) + "'");
    };
    var curlUploadLike = function (endpt, token, paramVals, file) {
        var headers = utils.uploadLikeHeaders(token, shellEscape(paramVals, false));
        return curlTemplate(endpt, headers, "\\\n  --data-binary @'" + file.name.replace(/'/g, "'\\''") + "'");
    };
    var curlDownloadLike = function (endpt, token, paramVals) {
        return curlTemplate(endpt, utils.getHeaders(endpt, token, shellEscape(paramVals, false)), '');
    };
    return {
        syntax: syntax,
        description: "curl request",
        renderRPCLike: curlRPCLike,
        renderUploadLike: curlUploadLike,
        renderDownloadLike: curlDownloadLike
    };
};
var HTTPCodeViewer = function () {
    var syntax = 'http';
    var httpTemplate = function (endpt, headers, body) {
        return syntaxHighlight(syntax, d.span(null, 'POST ' + endpt.getPathname() + "\n", 'Host: https://' + endpt.getHostname() + "\n", 'User-Agent: api-explorer-client\n', utils.Dict.map(headers, function (key, value) { return d.span({ key: key }, key + ": " + value + "\n"); }), body));
    };
    var httpRPCLike = function (endpt, token, paramVals) {
        var body = JSON.stringify(paramVals, null, 4);
        var headers = utils.RPCLikeHeaders(token);
        // TODO: figure out how to determine the UTF-8 encoded length
        //headers['Content-Length'] = ...
        return httpTemplate(endpt, headers, "\n" + body);
    };
    var httpUploadLike = function (endpt, token, paramVals, file) {
        var headers = utils.uploadLikeHeaders(token, JSON.stringify(paramVals));
        headers['Content-Length'] = file.size;
        return httpTemplate(endpt, headers, "\n--- (content of " + file.name + " goes here) ---");
    };
    var httpDownloadLike = function (endpt, token, paramVals) {
        var headers = utils.getHeaders(endpt, token, JSON.stringify(paramVals));
        return httpTemplate(endpt, headers, '');
    };
    return {
        syntax: syntax,
        description: 'HTTP request',
        renderRPCLike: httpRPCLike,
        renderUploadLike: httpUploadLike,
        renderDownloadLike: httpDownloadLike
    };
};
exports.formats = {
    'curl': CurlCodeViewer(),
    'requests': RequestsCodeViewer(),
    'httplib': HttplibCodeViewer(),
    'http': HTTPCodeViewer()
};
exports.getSelector = function (onChange) { return d.select({ onChange: onChange }, utils.Dict.map(exports.formats, function (key, cv) {
    return d.option({ key: key, value: key }, cv.description);
})); };
exports.render = function (cv, endpt, token, paramVals, file) {
    if (endpt.kind === utils.EndpointKind.RPCLike) {
        return cv.renderRPCLike(endpt, token, paramVals);
    }
    else if (file !== null) {
        return cv.renderUploadLike(endpt, token, paramVals, file);
    }
    else {
        return cv.renderDownloadLike(endpt, token, paramVals);
    }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./utils":6}],3:[function(require,module,exports){
/* The files contains helper functions to interact with cookie storage. This will be
   used a fallback when session/local storage is not allowed (safari private browsing
   mode etc.)
 */
exports.setItem = function (key, item) {
    document.cookie = encodeURIComponent(key) + "=" + encodeURIComponent(item);
};
exports.getItem = function (key) {
    var dict = exports.getAll();
    return dict[key];
};
exports.getAll = function () {
    var dict = {};
    var cookies = document.cookie.split('; ');
    cookies.forEach(function (value) {
        if (value.length > 0) {
            var items = value.split('=');
            dict[decodeURIComponent(items[0])] = decodeURIComponent(items[1]);
        }
    });
    return dict;
};

},{}],4:[function(require,module,exports){
var Utils = require('./utils');
var Endpoints;
(function (Endpoints) {
    var get = new Utils.Endpoint("files", "get", Utils.EndpointKind.RPCLike, new Utils.TextParam("id", false));
    var children = new Utils.Endpoint("files", "children", Utils.EndpointKind.RPCLike, new Utils.TextParam("id", true));
    var create = new Utils.Endpoint("files", "create", Utils.EndpointKind.RPCLike, new Utils.TextParam("name", false), new Utils.IntParam("parent", true), new Utils.JSONParam("json", true));
    var upload = new Utils.Endpoint("files", "upload", Utils.EndpointKind.Upload, new Utils.FileParam(), new Utils.IntParam("parent", true), new Utils.JSONParam("json", true));
    var update = new Utils.Endpoint("files", "update", Utils.EndpointKind.RPCLike, new Utils.TextParam("id", false), new Utils.JSONParam("json", true));
    var download = new Utils.Endpoint("files", "download", Utils.EndpointKind.Download, new Utils.TextParam("id", false));
    var del = new Utils.Endpoint("files", "delete", Utils.EndpointKind.RPCLike, new Utils.TextParam("id", false));
    Endpoints.endpointList = [get,
        children,
        create,
        upload,
        update,
        download,
        del];
})(Endpoints || (Endpoints = {}));
module.exports = Endpoints;

},{"./utils":6}],5:[function(require,module,exports){
(function (global){
/* The main file, which contains the definitions of the React components for the API Explorer, as
   well as a little bit of code that runs at startup.

   Each component is defined as an ES6 class extending the ReactComponent class. First, we declare
   the property types of the class, and then we declare the class itself.
 */
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var react = (typeof window !== "undefined" ? window['React'] : typeof global !== "undefined" ? global['React'] : null);
var endpoints = require('./endpoints');
var utils = require('./utils');
var apicalls = require('./apicalls');
var codeview = require('./codeview');
var ce = react.createElement;
var d = react.DOM;
var developerPage = 'https://www.rinocloud.com/documentation';
/* Element for text field in page table.
 */
var tableText = function (text) {
    return d.td({ className: 'label' }, d.div({ className: 'text' }, text));
};
var TokenInput = (function (_super) {
    __extends(TokenInput, _super);
    function TokenInput(props) {
        _super.call(this, props);
        this.handleEdit = function (event) {
            return utils.putToken(event.target.value);
        };
        // This function handles the initial part of the OAuth2 token flow for the user.
        this.retrieveAuth = function () {
            var win = window.open('https://' + utils.host + '/api/1/users/token/', '_blank');
            win.focus();
            var state = utils.getHashDict()['__ept__'] + '!' + utils.createCsrfToken();
            var params = {
                response_type: 'token',
                client_id: 'cg750anjts67v15',
                redirect_uri: utils.currentURL(),
                state: state
            };
            var urlWithParams = 'https://www.dropbox.com/1/oauth2/authorize?';
            for (var key in params) {
                urlWithParams += encodeURIComponent(key) + '=' + encodeURIComponent(params[key]) + '&';
            }
        };
    }
    TokenInput.prototype.render = function () {
        return d.tr(null, tableText('Access Token'), d.td(null, d.input({
            type: this.props.showToken ? 'text' : 'password',
            id: 'token-input',
            defaultValue: utils.getToken(),
            onChange: this.handleEdit,
            placeholder: 'If you don\'t have an access token, click the "Get Token" button to obtain one.'
        }), d.div({ className: 'align-right' }, d.button({ onClick: this.retrieveAuth }, 'Get Token'), d.button({ onClick: this.props.toggleShow }, this.props.showToken ? 'Hide Token' : 'Show Token'))));
    };
    return TokenInput;
})(react.Component);
var ParamInput = (function (_super) {
    __extends(ParamInput, _super);
    function ParamInput(props) {
        var _this = this;
        _super.call(this, props);
        // When the field is edited, its value is parsed and the state is updated.
        this.handleEdit = function (event) {
            var valueToReturn = null;
            // special case: the target isn't an HTMLInputElement
            if (_this.props.param.name === '__file__') {
                var fileTarget = event.target;
                if (fileTarget.files.length > 0)
                    valueToReturn = fileTarget.files[0];
            }
            else {
                var target = event.target;
                _this.setState({ text: target.value });
                /* If valueToReturn is left as null, it signals an optional value that should be
                   deleted from the dict of param values.
                 */
                if (target.value !== '' || !_this.props.param.optional) {
                    valueToReturn = _this.props.param.getValue(target.value);
                }
            }
            _this.props.onChange(_this.props.param.name, valueToReturn);
        };
        this.shouldComponentUpdate = function (_, newState) {
            return _this.state.text !== newState['text'];
        };
        this.state = { text: '' };
    }
    /* Since different kinds of parameters have to render differently, this render method is a
       wrapper to the parameter's own method.
    */
    ParamInput.prototype.render = function () {
        return this.props.param.asReact({ onChange: this.handleEdit });
    };
    return ParamInput;
})(react.Component);
/* Input component for single parameter.
 */
var SingleParamInput = (function (_super) {
    __extends(SingleParamInput, _super);
    function SingleParamInput() {
        _super.apply(this, arguments);
    }
    SingleParamInput.prototype.render = function () {
        return d.tbody(null, ce(ParamInput, this.props));
    };
    return SingleParamInput;
})(react.Component);
var StructParamInput = (function (_super) {
    __extends(StructParamInput, _super);
    function StructParamInput(props) {
        var _this = this;
        _super.call(this, props);
        // Updates the whole struct
        this.componentEdited = function (name, value) {
            var newFields = _this.state.fields;
            if (value === null)
                delete newFields[name];
            else
                newFields[name] = value;
            _this.setState({ fields: newFields });
            _this.props.onChange(_this.props.param.name, newFields);
        };
        // Updates a specific field
        this.fieldEdited = function (param, event) {
            var target = event.target;
            // If valueToReturn is null, it signifies that the value should be removed from the list
            var valueToReturn = (target.value !== '' || !param.optional) ?
                param.getValue(target.value) : null;
            _this.props.componentEdited(param.name, valueToReturn);
        };
        this.state = { fields: this.props.param.defaultValue() };
    }
    StructParamInput.prototype.render = function () {
        var _this = this;
        return d.tbody(null, utils.Dict.map(this.props.param.fields, function (name, value) {
            return ce(ParamInput, {
                key: _this.props.param.name + '_' + name,
                onChange: _this.componentEdited,
                param: value
            });
        }));
    };
    return StructParamInput;
})(react.Component);
// Picks the correct React class for a parameter, depending on whether it's a struct.
var paramClassChooser = function (param) { return param.isStructParam ?
    StructParamInput : SingleParamInput; };
var CodeArea = (function (_super) {
    __extends(CodeArea, _super);
    function CodeArea(props) {
        var _this = this;
        _super.call(this, props);
        this.changeFormat = function (event) {
            var newFormat = event.target.value;
            _this.setState({ formatter: codeview.formats[newFormat] });
        };
        this.state = { formatter: codeview.formats['curl'] };
    }
    CodeArea.prototype.render = function () {
        return d.span({ id: 'code-area' }, d.p(null, 'View request as ', codeview.getSelector(this.changeFormat)), d.span(null, codeview.render(this.state.formatter, this.props.ept, this.props.token, this.props.paramVals, this.props.__file__)));
    };
    return CodeArea;
})(react.Component);
var RequestArea = (function (_super) {
    __extends(RequestArea, _super);
    function RequestArea(props) {
        var _this = this;
        _super.call(this, props);
        this.updateParamValues = function (key, value) {
            if (key === '__file__') {
                _this.setState({ __file__: value });
            }
            else {
                var newVals = _this.state.paramVals;
                // null is used as a signal to delete the value
                if (value === null)
                    delete newVals[key];
                else
                    newVals[key] = value;
                _this.setState({ paramVals: newVals });
            }
        };
        /* Called when a new endpoint is chosen or the user updates the token. If a new endpoint is
           chosen, we should initialize its parameter values; if a new token is chosen, any error
           message about the token no longer applies.
         */
        this.componentWillReceiveProps = function (newProps) {
            if (newProps.currEpt !== _this.props.currEpt) {
                _this.setState({ paramVals: utils.initialValues(newProps.currEpt) });
            }
            _this.setState({ __file__: null, errMsg: null });
        };
        this.componentDidMount = function () {
            var ta = document.getElementsByTagName("textarea")[0];
            var cm = CodeMirror.fromTextArea(ta, { lineNumbers: true, mode: "javascript" });
            cm.on('change', function () {
                cm.save();
                var v = cm.getDoc().getValue();
                try {
                    this.updateParamValues('json', JSON.parse(v));
                }
                catch (Exception) {
                    return '';
                }
            }.bind(_this));
        };
        this.stringify = function () {
            return JSON.stringify(_this.flatten());
        };
        this.flatten = function () {
            var obj = JSON.parse(JSON.stringify(_this.state.paramVals));
            if (_this.state.paramVals.hasOwnProperty('json')) {
                for (var attrname in _this.state.paramVals.json) {
                    obj[attrname] = _this.state.paramVals.json[attrname];
                }
                delete obj.json;
            }
            return obj;
        };
        /* Submits a call to the API. This function handles the display logic (e.g. whether or not to
           display an error message for a missing token), and the APICaller prop actually sends the
           request.
         */
        this.submit = function () {
            var token = utils.getToken();
            if (token == null || token === '') {
                _this.setState({
                    errMsg: 'Error: missing token. Please enter a token above or click the "Get Token" button.'
                });
            }
            else {
                _this.setState({ errMsg: null });
                var responseFn = apicalls.chooseCallback(_this.props.currEpt.kind, utils.getDownloadName(_this.props.currEpt, _this.state.paramVals));
                _this.props.APICaller(_this.stringify(), _this.props.currEpt, token, responseFn, _this.state.__file__);
            }
        };
        // Toggles whether the token is hidden, or visible on the screen.
        this.showOrHide = function () { return _this.setState({ showToken: !_this.state.showToken }); };
        // Toggles whether code block is visiable.
        this.showOrHideCode = function () { return _this.setState({ showCode: !_this.state.showCode }); };
        this.state = {
            paramVals: utils.initialValues(this.props.currEpt),
            __file__: null,
            errMsg: null,
            showToken: true,
            showCode: false
        };
    }
    RequestArea.prototype.render = function () {
        var _this = this;
        var errMsg = [];
        if (this.state.errMsg != null) {
            errMsg = [d.span({ style: { color: 'red' } }, this.state.errMsg)];
        }
        var name = this.props.currEpt.name.replace('/', '-');
        var documentation = developerPage + "/documentation/http#documentation-" + this.props.currEpt.ns + "-" + name;
        return d.span({ id: 'request-area' }, d.table({ className: 'page-table' }, d.tbody(null, ce(TokenInput, {
            toggleShow: this.showOrHide,
            showToken: this.state.showToken
        }), d.tr(null, tableText('Request'), d.td(null, d.div({ className: 'align-right' }, d.a({ href: documentation }, 'Documentation')), d.table({ id: 'parameter-list' }, this.props.currEpt.params.map(function (param) {
            return ce(paramClassChooser(param), {
                key: _this.props.currEpt.name + param.name,
                onChange: _this.updateParamValues,
                param: param
            });
        })), d.div(null, d.button({ onClick: this.showOrHideCode }, this.state.showCode ? 'Hide Code' : 'Show Code'), d.button({ onClick: this.submit, disabled: this.props.inProgress }, 'Submit Call'), d.img({
            src: 'https://www.dropbox.com/static/images/icons/ajax-loading-small.gif',
            hidden: !this.props.inProgress,
            style: { position: 'relative', top: '2px', left: '10px' }
        }), errMsg))), d.tr({ hidden: !this.state.showCode }, tableText('Code'), d.td(null, d.div({ id: 'request-container' }))))));
    };
    return RequestArea;
})(react.Component);
var EndpointChoice = (function (_super) {
    __extends(EndpointChoice, _super);
    function EndpointChoice(props) {
        var _this = this;
        _super.call(this, props);
        this.onClick = function () { return _this.props.handleClick(_this.props.ept); };
    }
    EndpointChoice.prototype.render = function () {
        return (this.props.isSelected) ?
            d.li(null, d.b(null, this.props.ept.name), d.br(null)) :
            d.li(null, d.a({ onClick: this.onClick }, this.props.ept.name), d.br(null));
    };
    return EndpointChoice;
})(react.Component);
var EndpointSelector = (function (_super) {
    __extends(EndpointSelector, _super);
    function EndpointSelector(props) {
        _super.call(this, props);
    }
    // Renders the logo and the list of endpoints
    EndpointSelector.prototype.render = function () {
        var _this = this;
        var groups = {};
        var namespaces = [];
        endpoints.endpointList.forEach(function (ept) {
            if (groups[ept.ns] == undefined) {
                groups[ept.ns] = [ept];
                namespaces.push(ept.ns);
            }
            else {
                groups[ept.ns].push(ept);
            }
        });
        return d.div({ 'id': 'sidebar' }, d.p({ style: { marginLeft: '35px', marginTop: '12px' } }, d.a({ onClick: function () { return window.location.href = developerPage; } }, d.img({
            src: 'https://s3-eu-west-1.amazonaws.com/rinocloud/static/logo.png',
            width: 100,
            className: 'home-icon'
        }))), d.div({ id: 'endpoint-list' }, namespaces.sort().map(function (ns) {
            return d.div(null, d.li(null, ns), groups[ns].map(function (ept) {
                return ce(EndpointChoice, {
                    key: ept.name,
                    ept: ept,
                    handleClick: _this.props.eptChanged,
                    isSelected: _this.props.currEpt == ept.name
                });
            }));
        })));
    };
    return EndpointSelector;
})(react.Component);
var ResponseArea = (function (_super) {
    __extends(ResponseArea, _super);
    function ResponseArea(props) {
        _super.call(this, props);
    }
    ResponseArea.prototype.render = function () {
        return d.span({ id: 'response-area' }, d.table({ className: 'page-table', hidden: this.props.hide }, d.tbody(null, d.tr(null, tableText('Response'), d.td(null, d.div({ id: 'response-container' }, ce(utils.Highlight, { className: 'json' }, this.props.responseText)), d.div(null, this.props.downloadButton))))));
    };
    return ResponseArea;
})(react.Component);
var APIExplorer = (function (_super) {
    __extends(APIExplorer, _super);
    function APIExplorer(props) {
        var _this = this;
        _super.call(this, props);
        this.componentWillReceiveProps = function (newProps) { return _this.setState({
            ept: newProps.initEpt,
            downloadURL: '',
            responseText: ''
        }); };
        this.APICaller = function (paramsData, endpt, token, responseFn, file) {
            _this.setState({ inProgress: true });
            var responseFn_wrapper = function (component, resp) {
                _this.setState({ inProgress: false });
                responseFn(component, resp);
            };
            apicalls.APIWrapper(paramsData, endpt, token, responseFn_wrapper, _this, file);
        };
        this.state = {
            ept: this.props.initEpt,
            downloadURL: '',
            responseText: '',
            inProgress: false
        };
    }
    APIExplorer.prototype.render = function () {
        // This button pops up only on download
        var downloadButton = (this.state.downloadURL !== '') ?
            d.a({
                href: this.state.downloadURL,
                download: this.state.downloadFilename
            }, d.button(null, 'Download ' + this.state.downloadFilename)) :
            null;
        return ce(MainPage, {
            currEpt: this.state.ept,
            header: d.span(null, 'Rinocloud API Explorer • ' + this.state.ept.name),
            messages: [
                ce(RequestArea, {
                    currEpt: this.state.ept,
                    APICaller: this.APICaller,
                    inProgress: this.state.inProgress
                }),
                ce(ResponseArea, {
                    hide: this.state.inProgress || this.state.responseText == '',
                    responseText: this.state.responseText,
                    downloadButton: downloadButton
                })
            ].map(function (t) { return t; })
        });
    };
    return APIExplorer;
})(react.Component);
var MainPage = (function (_super) {
    __extends(MainPage, _super);
    function MainPage(props) {
        _super.call(this, props);
    }
    MainPage.prototype.render = function () {
        return d.span(null, ce(EndpointSelector, {
            eptChanged: function (endpt) { return window.location.hash = '#' + endpt.name; },
            currEpt: this.props.currEpt.name
        }), d.h1({ id: 'header' }, this.props.header), d.div({ id: 'page-content' }, this.props.messages));
    };
    return MainPage;
})(react.Component);
var TextPage = (function (_super) {
    __extends(TextPage, _super);
    function TextPage(props) {
        _super.call(this, props);
    }
    TextPage.prototype.render = function () {
        return ce(MainPage, {
            currEpt: new utils.Endpoint('', '', null),
            header: d.span(null, 'Rinocloud API Explorer'),
            messages: [this.props.message]
        });
    };
    return TextPage;
})(react.Component);
// Introductory page, which people see when they first open the webpage
var introPage = ce(TextPage, {
    message: d.span(null, d.p(null, 'Welcome to the Rinocloud API Explorer!'), d.p(null, 'This API Explorer is a tool to help you learn about the ', d.a({ href: developerPage }, 'Rinocloud API v2'), " and test your own examples. For each endpoint, you'll be able to submit an API call ", 'with your own parameters and see the code for that call, as well as the API response.'), d.p(null, 'Click on an endpoint on your left to get started, or check out ', d.a({ href: developerPage + '/documentation' }, 'the documentation'), ' for more information on the API.')) });
/* The endpoint name (supplied via the URL's hash) doesn't correspond to any actual endpoint. Right
   now, this can only happen if the user edits the URL hash.
   React sanitizes its inputs, so displaying the hash below is safe.
 */
var endpointNotFound = ce(TextPage, {
    message: d.span(null, d.p(null, 'Welcome to the Rinocloud API Explorer!'), d.p(null, "Unfortunately, there doesn't seem to be an endpoint called ", d.b(null, window.location.hash.substr(1)), '. Try clicking on an endpoint on the left instead.'), d.p(null, 'If you think you received this message in error, please get in contact with us.')) });
/* Error when the state parameter of the hash isn't what was expected, which could be due to an
   XSRF attack.
 */
var stateError = ce(TextPage, {
    message: d.span(null, d.p(null, ''), d.p(null, 'Unfortunately, there was a problem retrieving your OAuth2 token; please try again. ', 'If this error persists, you may be using an insecure network.'), d.p(null, 'If you think you received this message in error, please get in contact with us.')) });
/* The hash of the URL determines which page to render; no hash renders the intro page, and
   'auth_error!' (the ! chosen so it's less likely to have a name clash) renders the stateError
   page when the state parameter isn't what was expected.
 */
var renderGivenHash = function (hash) {
    if (hash === '' || hash === undefined) {
        react.render(introPage, document.body);
    }
    else if (hash === 'xkcd') {
        window.location.href = 'https://xkcd.com/1481/';
    }
    else if (hash === 'auth_error!') {
        react.render(stateError, document.body);
    }
    else {
        var currEpt = utils.getEndpoint(endpoints.endpointList, decodeURIComponent(hash));
        if (currEpt === null) {
            react.render(endpointNotFound, document.body);
        }
        else {
            react.render(ce(APIExplorer, { initEpt: currEpt }), document.body);
        }
    }
};
var checkCsrf = function (state) {
    if (state === null)
        return null;
    var div = state.indexOf('!');
    if (div < 0)
        return null;
    var csrfToken = state.substring(div + 1);
    if (!utils.checkCsrfToken(csrfToken))
        return null;
    return state.substring(0, div); // The part before the CSRF token.
};
/* Things that need to be initialized at the start.
    1. Set up the listener for hash changes.
    2. Process the initial hash. This only occurs when the user goes through token flow, which
       redirects the page back to the API Explorer website, but with a hash that contains the
       token and some extra state (to check against XSRF attacks).
 */
var main = function () {
    window.onhashchange = function (e) {
        //first one works everywhere but IE, second one works everywhere but Firefox 40
        renderGivenHash(e.newURL ? e.newURL.split('#')[1] : window.location.hash.slice(1));
    };
    var hashes = utils.getHashDict();
    if ('state' in hashes) {
        var state = checkCsrf(hashes['state']);
        if (state === null) {
            window.location.hash = '#auth_error!';
        }
        else {
            utils.putToken(hashes['access_token']);
            window.location.href = utils.currentURL() + '#' + state;
        }
    }
    else if ('__ept__' in hashes) {
        renderGivenHash(hashes['__ept__']);
    }
    else {
        react.render(introPage, document.body);
    }
};
main();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./apicalls":1,"./codeview":2,"./endpoints":4,"./utils":6}],6:[function(require,module,exports){
(function (global){
/* This file contains utility functions needed by the other modules. These can be grouped into the
   following broad categories:

   - Definitions of the Endpoint and Parameter classes, and the various Parameter subclasses
     corresponding to the different kinds of parameters
   - Utilities for token flow: getting and setting state, and retrieving or storing the token in
     session storage
   - Utilities for processing user input in order to submit it
   - A React class for highlighting the code view and response parts of the document
   - Functions to generate the headers for a given API call
 */
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var react = (typeof window !== "undefined" ? window['React'] : typeof global !== "undefined" ? global['React'] : null);
var hljs = (typeof window !== "undefined" ? window['hljs'] : typeof global !== "undefined" ? global['hljs'] : null);
var cookie = require('./cookie');
exports.host = 'rinocloud-staging-pr-70.herokuapp.com';
var ce = react.createElement;
var d = react.DOM;
// This class mostly exists to help Typescript type-check my programs.
var Dict = (function () {
    function Dict() {
    }
    /* Two methods for mapping through dictionaries, customized to the API Explorer's use case.
       - _map takes function from a key, a value, and an index to a React element, and
       - map is the same, but without an index.
       These are used, for example, to convert a dict of HTTP headers into its representation
       in code view.
     */
    Dict._map = function (dc, f) {
        return Object.keys(dc).map(function (key, i) { return f(key, dc[key], i); });
    };
    Dict.map = function (dc, f) {
        return Object.keys(dc).map(function (key) { return f(key, dc[key]); });
    };
    return Dict;
})();
exports.Dict = Dict;
/* Helper class which deal with local storage. If session storage is allowed, items
   will be written to session storage. If session storage is disabled (e.g. safari
   private browsing mode), cookie storage will be used as fallback.
 */
var LocalStorage = (function () {
    function LocalStorage() {
    }
    LocalStorage._is_session_storage_allowed = function () {
        var test = 'test';
        try {
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        }
        catch (e) {
            return false;
        }
    };
    LocalStorage.setItem = function (key, data) {
        if (LocalStorage._is_session_storage_allowed()) {
            sessionStorage.setItem(key, data);
        }
        else {
            cookie.setItem(key, data);
        }
    };
    LocalStorage.getItem = function (key) {
        if (LocalStorage._is_session_storage_allowed()) {
            return sessionStorage.getItem(key);
        }
        else {
            return cookie.getItem(key);
        }
    };
    return LocalStorage;
})();
exports.LocalStorage = LocalStorage;
/* There are three kinds of endpoints, and a lot of the program logic depends on what kind of
   endpoint is currently being shown.
    - An RPC-like endpoint involves no uploading or downloading of data; it sends a request
      with JSON data in the body, and receives a JSON response. Example: get_metadata
    - An upload-like endpoint sends file data in the body and the arguments in a header, but
      receives a JSON response. Example: upload
    - A download-style endpoint sends a request with JSON data, but receives the file in the
      response body. Example: get_thumbnail
 */
(function (EndpointKind) {
    EndpointKind[EndpointKind["RPCLike"] = 0] = "RPCLike";
    EndpointKind[EndpointKind["Upload"] = 1] = "Upload";
    EndpointKind[EndpointKind["Download"] = 2] = "Download";
})(exports.EndpointKind || (exports.EndpointKind = {}));
var EndpointKind = exports.EndpointKind;
;
/* A class with all the information about an endpoint: its name and namespace; its kind
   (as listed above), and its list of parameters. The endpoints are all initialized in
   endpoints.ts, which is code-generated.
 */
var Endpoint = (function () {
    function Endpoint(ns, name, kind) {
        var _this = this;
        var params = [];
        for (var _i = 3; _i < arguments.length; _i++) {
            params[_i - 3] = arguments[_i];
        }
        this.getHostname = function () { return exports.host + '/api/1/'; };
        this.getPathname = function () { return '' + _this.ns + '/' + _this.name; };
        this.getURL = function () { return 'https://' + _this.getHostname() + _this.getPathname() + '/'; };
        this.ns = ns;
        this.name = name;
        this.kind = kind;
        this.params = params;
    }
    return Endpoint;
})();
exports.Endpoint = Endpoint;
/* A parameter to an API endpoint. This class is abstract, as different kinds of parameters
   (e.g. text, integer) will implement it differently.
 */
var Parameter = (function () {
    function Parameter(name, optional) {
        this.isStructParam = false;
        /* Each subclass will implement these abstract methods differently.
            - getValue should parse the value in the string and return the (typed) value for that
              parameter. For example, integer parameters will use parseInt here.
            - defaultValue should return the initial value if the endpoint is required (e.g.
              0 for integers, '' for strings).
            - innerReact determines how to render the input field for a parameter.
         */
        this.getValue = function (s) { return s; };
        this.defaultValue = function () { return ""; };
        this.innerReact = function (props) { return null; };
        this.name = name;
        this.optional = optional;
    }
    /* Renders the parameter's input field, using another method which depends on the
       parameter's subclass.
     */
    Parameter.prototype.asReact = function (props) {
        var nameArgs = this.optional ? { 'style': { 'color': '#999' } } : {};
        var displayName = (this.name !== '__file__') ? this.name : 'File to upload';
        if (this.optional)
            displayName += ' (optional)';
        return d.tr(null, d.td(nameArgs, displayName), d.td(null, this.innerReact(props)));
    };
    return Parameter;
})();
exports.Parameter = Parameter;
exports.parameterInput = function (props) {
    props['className'] = 'parameter-input';
    return d.input(props);
};
// A parameter whose value is a string.
var TextParam = (function (_super) {
    __extends(TextParam, _super);
    function TextParam(name, optional) {
        _super.call(this, name, optional);
        this.innerReact = function (props) { return exports.parameterInput(props); };
    }
    return TextParam;
})(Parameter);
exports.TextParam = TextParam;
// A parameter whose value is an integer.
var IntParam = (function (_super) {
    __extends(IntParam, _super);
    function IntParam(name, optional) {
        var _this = this;
        _super.call(this, name, optional);
        this.innerReact = function (props) { return exports.parameterInput(props); };
        this.getValue = function (s) { return (s === '') ? _this.defaultValue() : parseInt(s, 10); };
        this.defaultValue = function () { return 0; };
    }
    return IntParam;
})(Parameter);
exports.IntParam = IntParam;
// A parameter whose value is json
var JSONParam = (function (_super) {
    __extends(JSONParam, _super);
    function JSONParam(name, optional) {
        _super.call(this, name, optional);
        this.getValue = function (s) {
            try {
                return JSON.parse(s);
            }
            catch (Exception) {
                return '';
            }
        };
        this.innerReact = function (props) {
            // props['className'] = 'parameter-input'
            // props['style'] = {'minHeight': '300px', 'width': '400px'}
            props['rows'] = 50;
            return d.textarea(props);
        };
        this.defaultValue = function () { };
    }
    return JSONParam;
})(Parameter);
exports.JSONParam = JSONParam;
/* A parameter whose value is a float.
   This isn't currently used in our API, but could be in the future.
 */
var FloatParam = (function (_super) {
    __extends(FloatParam, _super);
    function FloatParam(name, optional) {
        var _this = this;
        _super.call(this, name, optional);
        this.innerReact = function (props) { return exports.parameterInput(props); };
        this.getValue = function (s) { return (s === '') ? _this.defaultValue() : parseFloat(s); };
        this.defaultValue = function () { return 0; };
    }
    return FloatParam;
})(Parameter);
exports.FloatParam = FloatParam;
/* An enumerated type, e.g. simple unions or booleans.
   TODO: more complicated unions (i.e. of more than just unit types) are currently not
   supported. For example, the mode argument to the upload endpoint has a union of two
   void types and a string; we would like to be able to support these, but haven't gotten
   around to it yet.
 */
var SelectorParam = (function (_super) {
    __extends(SelectorParam, _super);
    function SelectorParam(name, choices, optional) {
        var _this = this;
        _super.call(this, name, optional);
        this.innerReact = function (props) { return d.select(props, _this.choices.map(function (choice) { return d.option({
            key: choice,
            value: choice
        }, choice); })); };
        this.defaultValue = function () { return _this.choices[0]; };
        this.choices = choices;
        if (this.optional) {
            this.choices.unshift(''); // signals leaving an optional parameter out
        }
    }
    return SelectorParam;
})(Parameter);
exports.SelectorParam = SelectorParam;
// Booleans are selectors for true or false.
var BoolParam = (function (_super) {
    __extends(BoolParam, _super);
    function BoolParam(name, optional) {
        _super.call(this, name, ['false', 'true'], optional);
        this.getValue = function (s) { return s === 'true'; };
    }
    return BoolParam;
})(SelectorParam);
exports.BoolParam = BoolParam;
/* Upload-style endpoints accept data to upload. This is implemented as a special parameter
   to each endpoint, with the special name __file__. However, it's not technically an
   argument to its endpoint: the file is handled separately from the other parameters, since
   its contents are treated as data.
   Note that, since the name is fixed, only one file parameter can be used per endpoint right
   now.
 */
var FileParam = (function (_super) {
    __extends(FileParam, _super);
    function FileParam() {
        _super.call(this, '__file__', false);
        this.innerReact = function (props) {
            props['type'] = 'file';
            return exports.parameterInput(props);
        };
    }
    return FileParam;
})(Parameter);
exports.FileParam = FileParam;
/* A few parameters are structs whose fields are other parameters. The user will just see the
   fields as if they were top-level parameters, but the backend collects them into one
   dictionary.
   TODO: can structs be optional? If so, how do I hint this to the user?
 */
var StructParam = (function (_super) {
    __extends(StructParam, _super);
    function StructParam(name, optional) {
        var _this = this;
        var fields = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            fields[_i - 2] = arguments[_i];
        }
        _super.call(this, name, optional);
        this.isStructParam = true;
        this.defaultValue = function () {
            var toReturn = {};
            for (var name_1 in _this.fields) {
                if (!_this.fields[name_1].optional) {
                    toReturn[name_1] = _this.fields[name_1].defaultValue();
                }
            }
            return toReturn;
        };
        this.fields = {};
        fields.forEach(function (nextField) { return _this.fields[nextField.name] = nextField; });
    }
    return StructParam;
})(Parameter);
exports.StructParam = StructParam;
// Utilities for token flow
var csrfTokenStorageName = 'csrftoken';
var tokenStorageName = 'Dropbox_API_explorer_token';
exports.createCsrfToken = function () {
    var randomBytes = new Uint8Array(18); // multiple of 3 avoids base-64 padding
    // If available, use the cryptographically secure generator, otherwise use Math.random.
    var crypto = window.crypto || window.msCrypto;
    if (crypto && crypto.getRandomValues && false) {
        crypto.getRandomValues(randomBytes);
    }
    else {
        for (var i = 0; i < randomBytes.length; i++) {
            randomBytes[i] = Math.floor(Math.random() * 256);
        }
    }
    var token = btoa(String.fromCharCode.apply(null, randomBytes)); // base64-encode
    LocalStorage.setItem(csrfTokenStorageName, token);
    return token;
};
exports.checkCsrfToken = function (givenCsrfToken) {
    var expectedCsrfToken = LocalStorage.getItem(csrfTokenStorageName);
    if (expectedCsrfToken === null)
        return false;
    return givenCsrfToken === expectedCsrfToken; // TODO: timing attack in string comparison?
};
// A utility to read the URL's hash and parse it into a dict.
exports.getHashDict = function () {
    var toReturn = {};
    var index = window.location.href.indexOf('#');
    if (index === -1)
        return toReturn;
    var hash = window.location.href.substr(index + 1);
    var hashes = hash.split('#');
    hashes.forEach(function (s) {
        if (s.indexOf('&') == -1)
            toReturn['__ept__'] = decodeURIComponent(s);
        else {
            s.split('&').forEach(function (pair) {
                var splitPair = pair.split('=');
                toReturn[decodeURIComponent(splitPair[0])] = decodeURIComponent(splitPair[1]);
            });
        }
    });
    return toReturn;
};
// Reading and writing the token, which is preserved in LocalStorage.
exports.putToken = function (token) {
    return LocalStorage.setItem(tokenStorageName, token);
};
exports.getToken = function () { return LocalStorage.getItem(tokenStorageName); };
// Some utilities that help with processing user input
// Returns an endpoint given its name, or null if there was none
exports.getEndpoint = function (epts, name) {
    for (var i = 0; i < epts.length; i++) {
        if (epts[i].name === name)
            return epts[i];
    }
    return null; // signals an error
};
/* Returns the intial values for the parameters of an endpoint. Specifically, the non-optional
   parameters' initial values are put into the paramVals dictionary. This ensures that the
   required parameters are never missing when the 'submit' button is pressed.
   If there are no parameters (except possibly a file), then the dict should be null rather
   than an empty dict.
 */
exports.initialValues = function (ept) {
    if (ept.params.length == 0)
        return null;
    if (ept.params.length == 1 && ept.params[0].name === '__file__')
        return null;
    var toReturn = {};
    ept.params.forEach(function (param) {
        if (!param.optional && param.name !== '__file__') {
            toReturn[param.name] = param.defaultValue();
        }
    });
    return toReturn;
};
/* For a download endpoint, this function calculates the filename that the data should be saved
   as. First, it takes the basename of the 'path' argument, and then changes the extension for
   the get_thumbnail endpoint (which is a special case).
   This function assumes every download-style endpoint has a parameter named 'path.'
 */
exports.getDownloadName = function (ept, paramVals) {
    if (paramVals !== null && 'path' in paramVals) {
        var toReturn = paramVals['path'].split('/').pop();
        if (ept.name === 'get_thumbnail') {
            var format = ('format' in paramVals) ? paramVals['format'] : 'jpeg';
            toReturn = toReturn.substr(0, toReturn.lastIndexOf('.')) + '.' + format;
        }
        return toReturn;
    }
    else
        return ''; // not a download-style endpoint anyways
};
// Returns the current URL without any fragment
exports.currentURL = function () { return window.location.href.split('#', 1)[0]; };
exports.arrayBufToString = function (buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
};
var isJson = function (s) {
    try {
        JSON.parse(s);
        return true;
    }
    catch (_) {
        return false;
    }
};
// Applies pretty-printing to JSON data serialized as a string.
exports.prettyJson = function (s) { return JSON.stringify(JSON.parse(s), null, 2); };
// common message for error handling
exports.errorHandler = function (stat, response) {
    if (isJson(response))
        return d.code(null, exports.prettyJson(response));
    else
        return d.span(null, d.h4(null, "Error: " + stat), d.code(null, response));
};
// Since HTTP headers cannot contain arbitrary Unicode characters, we must replace them.
exports.escapeUnicode = function (s) { return s.replace(/[\u007f-\uffff]/g, function (c) { return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4); }); };
var Highlight = (function (_super) {
    __extends(Highlight, _super);
    function Highlight(props) {
        var _this = this;
        _super.call(this, props);
        this.defaultProps = { className: "" };
        this.componentDidMount = function () { return _this.highlightCode(); };
        this.componentDidUpdate = function () { return _this.highlightCode(); };
        this.highlightCode = function () { return [].forEach.call(react.findDOMNode(_this).querySelectorAll('pre code'), function (node) { return hljs.highlightBlock(node); }); };
    }
    Highlight.prototype.render = function () {
        return d.pre({ className: this.props.className }, d.code({ className: this.props.className }, this.props.children));
    };
    return Highlight;
})(react.Component);
exports.Highlight = Highlight;
// Utility functions for getting the headers for an API call
// The headers for an RPC-like endpoint HTTP request
exports.RPCLikeHeaders = function (token) {
    return {
        Authorization: "Token " + token,
        "Content-Type": "application/json"
    };
};
// args may need to be modified by the client, so they're passed in as a string
exports.uploadLikeHeaders = function (token, args) {
    return {
        Authorization: "Token " + token
    };
};
exports.downloadLikeHeaders = function (token, args) {
    return {
        Authorization: "Token " + token,
        "Content-Type": "application/json"
    };
};
exports.getHeaders = function (ept, token, args) {
    switch (ept.kind) {
        case EndpointKind.RPCLike: return exports.RPCLikeHeaders(token);
        case EndpointKind.Upload: return exports.uploadLikeHeaders(token, args);
        case EndpointKind.Download: return exports.downloadLikeHeaders(token, args);
    }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./cookie":3}],7:[function(require,module,exports){

},{}]},{},[5,7])


//# sourceMappingURL=all.js.map
