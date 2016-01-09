import Utils = require('./utils');
module Endpoints {
    const get = new Utils.Endpoint("files", "get", Utils.EndpointKind.RPCLike,
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
    const create = new Utils.Endpoint("files", "create_folder", Utils.EndpointKind.RPCLike,
        new Utils.TextParam("name", false),
        new Utils.IntParam("parent", true),
        new Utils.JSONParam("json", true)
    );
    const upload = new Utils.Endpoint("files", "upload", Utils.EndpointKind.Upload,
        new Utils.FileParam(),
        new Utils.IntParam("parent", true),
        new Utils.JSONParam("json", true)
    );
    const update = new Utils.Endpoint("files", "update", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", false),
        new Utils.JSONParam("json", true)
    );
    const download = new Utils.Endpoint("files", "download", Utils.EndpointKind.Download,
        new Utils.IntParam("id", false)
    );
    const del = new Utils.Endpoint("files", "delete", Utils.EndpointKind.RPCLike,
        new Utils.IntParam("id", false)
    );
    export const endpointList: Utils.Endpoint[] = [get,
                                                   children,
                                                   ancestors,
                                                   create,
                                                   upload,
                                                   update,
                                                   download,
                                                   del];
}
export = Endpoints;
