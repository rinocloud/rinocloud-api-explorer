
// POST      /create_folder/           new a folder like object
// POST      /upload_multipart/        uploads a file
// POST      /upload_binary/           uploads a file
// POST      /update_metadata/         updates an object
// POST      /get_metadata/            gets record of id
// POST      /children/                gets children of current folder
// POST      /ancestors/               gets parents of current file or folder
// POST/GET  /download/                downloads a file
// POST      /delete/                  deletes an object - will delete all children
// POST      /delete_metadata_field/   deletes a field from an objects metadata
// POST      /move/
// POST      /copy/
// POST      /search/
// POST      /autocomplete/

import Utils = require('./utils');
module Endpoints {
    const create_folder = new Utils.Endpoint("files", "create_folder", Utils.EndpointKind.RPCLike,
        new Utils.TextParam("name", false),
        new Utils.IntParam("parent", true),
        new Utils.JSONParam("json", true)
    );
    const upload = new Utils.Endpoint("files", "upload_multipart", Utils.EndpointKind.Upload,
        new Utils.FileParam(),
        new Utils.IntParam("parent", true),
        new Utils.JSONParam("json", true)
    );
    const update = new Utils.Endpoint("files", "update_metadata", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", false),
        new Utils.JSONParam("json", true)
    );
    const get = new Utils.Endpoint("files", "get_metadata", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", false)
    );
    const children = new Utils.Endpoint("files", "children", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", true),
        new Utils.IntParam("limit", true),
        new Utils.IntParam("offset", true)
    );
    const ancestors = new Utils.Endpoint("files", "ancestors", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", true)
    );
    const download = new Utils.Endpoint("files", "download", Utils.EndpointKind.Download,
        new Utils.IntParam("id", false)
    );
    const del = new Utils.Endpoint("files", "delete", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", false)
    );
    const delete_metadata_field = new Utils.Endpoint("files", "delete_metadata_field", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", false),
        new Utils.TextParam("field", false)
    );
    const move = new Utils.Endpoint("files", "move", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", false)
    );
    const copy = new Utils.Endpoint("files", "copy", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", false)
    );
    const search = new Utils.Endpoint("files", "search", Utils.EndpointKind.RPCLike,
        new Utils.TextParam("query", false)
    );
    const autocomplete = new Utils.Endpoint("files", "autocomplete", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", false)
    );
    export const endpointList: Utils.Endpoint[] = [ create_folder,
                                                    upload,
                                                    update,
                                                    get,
                                                    children,
                                                    ancestors,
                                                    download,
                                                    del,
                                                    delete_metadata_field,
                                                    move,
                                                    copy,
                                                    search,
                                                    autocomplete,
    ];
}
export = Endpoints;
