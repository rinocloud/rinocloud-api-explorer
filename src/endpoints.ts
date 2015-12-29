import Utils = require('./utils');
module Endpoints {
    const get = new Utils.Endpoint("files", "get", Utils.EndpointKind.RPCLike,
        new Utils.TextParam("id", false)
    );
    const children = new Utils.Endpoint("files", "children", Utils.EndpointKind.RPCLike,
        new Utils.TextParam("id", true)
    );
    const create = new Utils.Endpoint("files", "create", Utils.EndpointKind.RPCLike,
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
        new Utils.TextParam("id", false),
        new Utils.JSONParam("json", true)
    );
    const download = new Utils.Endpoint("files", "download", Utils.EndpointKind.Download,
        new Utils.TextParam("id", false)
    );
    const del = new Utils.Endpoint("files", "delete", Utils.EndpointKind.RPCLike,
        new Utils.TextParam("id", false)
    );
    export const endpointList: Utils.Endpoint[] = [get,
                                                   children,
                                                   create,
                                                   upload,
                                                   update,
                                                   download,
                                                   del];
}
export = Endpoints;
