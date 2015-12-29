/* This file contains a module for functions that make calls to the API and their associated
   helper functions.
 */

import react = require('react');
import utils = require('./utils');

export type Callback = (component: react.Component<any, any>, req: XMLHttpRequest) => void;

/* Listener functions for the API calls; since downloads have a non-JSON response, they need a
   separate listener.
 */
const JSONListener = (component: any, resp: XMLHttpRequest) => {
    const response: string = resp.responseText;
    if (resp.status !== 200) {
        component.setState({responseText: utils.errorHandler(resp.status, response)});
    } else {
        component.setState({responseText: utils.prettyJson(response)});
    }
}
const DownloadCallListener = (component: any, resp: XMLHttpRequest, path: string) => {
    if (resp.status !== 200) {
        component.setState({responseText:
            utils.errorHandler(resp.status, utils.arrayBufToString(resp.response))
        });
    } else {
        const response: string = resp.getResponseHeader('rinocloud-api-result');
        component.setState({responseText: utils.prettyJson(response)});

        const toDownload: Blob = new Blob([resp.response], {type: 'multipart/form-data'});
        component.setState({
            downloadURL:      URL.createObjectURL(toDownload),
            downloadFilename: JSON.parse(response).name
        })
    }
}

/* Utility for determining the correct callback function given an endpoint's kind
   Since the download listener needs to know the filename (for saving the file), it's
   passed through this function.
 */
export const chooseCallback = (k: utils.EndpointKind, path: string) => {
    switch(k) {
        case utils.EndpointKind.Download:
            return (component: any, resp: XMLHttpRequest) =>
                DownloadCallListener(component, resp, path);
        default: return JSONListener;
    }
}

const initRequest = (endpt: utils.Endpoint, headers: utils.Dict,
                     listener: Callback, component: any): XMLHttpRequest => {
    let request = new XMLHttpRequest();
    request.onload = (_: Event) => listener(component, request);
    request.open('POST', endpt.getURL(), true);
    request.setRequestHeader('Access-Control-Allow-Headers','X-Requested-With,rinocloud-api-result')
    request.setRequestHeader('X-Requested-With','XMLHttpRequest')
    request.setRequestHeader('rinocloud-api-result','*')

    for (let key in headers) {
        request.setRequestHeader(key, headers[key]);
    }
    return request;
}

const beginRequest = (component: any) => {
    component.setState({inProgress: true});
    component.setState({hideResponse: true});
}

const endRequest = (component: any) => {
    component.setState({inProgress: false});
    component.setState({hideResponse: false});
}

/* This function actually makes the API call. There are three different paths, based on whether
   the endpoint is upload-like, download-like, or RPC-like.
   The file parameter will be null unless the user specified a file on an upload-like endpoint.
 */
export const APIWrapper = (data: string, endpt: utils.Endpoint, token: string,
                           listener: Callback, component: any, file: File): void => {
    beginRequest(component);

    const listener_wrapper: Callback = (component: any, resp: XMLHttpRequest) => {
        endRequest(component);
        listener(component, resp);
    };

    switch (endpt.kind) {
        case utils.EndpointKind.RPCLike:
            var request = initRequest(endpt, utils.RPCLikeHeaders(token), listener_wrapper, component);
            request.send(data);
            break;
        case utils.EndpointKind.Upload:
            var request = initRequest(endpt, utils.uploadLikeHeaders(token, data),
                listener_wrapper, component);
            if (file !== null) {
                var formData = new FormData();
                formData.append("file", file);
                formData.append("json", data);
                request.send(formData);
            } else {
                request.send();
            }
            break;
        case utils.EndpointKind.Download:
            var win = window.open(endpt.getURL() + '?id=' + JSON.parse(data).id, '_blank');
            win.focus();
            endRequest(component)
            break;
    }
}
