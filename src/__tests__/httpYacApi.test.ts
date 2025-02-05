import { send } from '../httpYacApi';
import * as io from '../io';
import { HttpFileStore } from '../store';
import { promises as fs } from 'fs';
import { getLocal } from 'mockttp';
import { EOL } from 'os';
import { isAbsolute, dirname, extname, join } from 'path';

function initFileProvider(files?: Record<string, string> | undefined) {
  const fileProvider = io.fileProvider;
  fileProvider.EOL = EOL;

  fileProvider.isAbsolute = async fileName => isAbsolute(fileProvider.toString(fileName));
  fileProvider.dirname = fileName => dirname(fileProvider.toString(fileName));
  fileProvider.hasExtension = (fileName, ...extensions) =>
    extensions.indexOf(extname(fileProvider.toString(fileName))) >= 0;
  fileProvider.joinPath = (fileName, path) => join(fileProvider.toString(fileName), path);
  fileProvider.exists = async fileName => Promise.resolve(typeof fileName === 'string' && !!files && !!files[fileName]);
  fileProvider.readFile = filename => {
    if (typeof filename === 'string' && files && files[filename]) {
      return Promise.resolve(files[filename]);
    }
    throw new Error('No File');
  };
  fileProvider.readBuffer = filename => {
    if (typeof filename === 'string' && files && files[filename]) {
      return Promise.resolve(Buffer.from(files[filename]));
    }
    throw new Error('No File');
  };
  fileProvider.readdir = async dirname => fs.readdir(fileProvider.toString(dirname));
}

describe('send', () => {
  const localServer = getLocal();
  beforeEach(() => localServer.start(8080));
  afterEach(() => localServer.stop());
  describe('http', () => {
    it('get http', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer.forGet('/get').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
GET http://localhost:8080/get
`),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].headers['user-agent']).toBe('httpyac');
    });
    it('get http with multiline', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer.forGet('/bar').thenReply(200);
      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
GET http://localhost:8080
  /bar
  ?test=foo
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });

      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].path).toBe('/bar?test=foo');
      expect(result).toBeTruthy();
    });
    it('get http with headers', async () => {
      initFileProvider();

      const mockedEndpoints = await localServer.forGet('/get').thenReply(200);
      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
GET http://localhost:8080/get
Authorization: Bearer test
Date: 2015-06-01
        `),
        0,
        {
          workingDir: __dirname,
        }
      );

      const result = await send({
        httpFile,
      });

      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].headers.authorization).toBe('Bearer test');
      expect(requests[0].headers.date).toBe('2015-06-01');
      expect(result).toBeTruthy();
    });
    it('post http', async () => {
      initFileProvider();
      const body = JSON.stringify({ foo: 'foo', bar: 'bar' }, null, 2);
      const mockedEndpoints = await localServer.forPost('/post').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
POST http://localhost:8080/post
Content-Type: application/json

${body}
        `),
        0,
        {}
      );
      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].headers['content-type']).toBe('application/json');
      expect(await requests[0].body.getText()).toBe(body);
    });
    it('imported body', async () => {
      const body = JSON.stringify({ foo: 'foo', bar: 'bar' }, null, 2);
      initFileProvider({
        'body.json': body,
      });

      const mockedEndpoints = await localServer.forPost('/post').thenReply(200);
      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
POST http://localhost:8080/post
Content-Type: application/json

<@ ./body.json
        `),
        0,
        {
          workingDir: __dirname,
        }
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();

      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].headers['content-type']).toBe('application/json');
      expect(await requests[0].body.getText()).toBe(body);
    });
    it('imported buffer body', async () => {
      const body = JSON.stringify({ foo: 'foo', bar: 'bar' }, null, 2);
      initFileProvider({
        'body.json': body,
      });
      const mockedEndpoints = await localServer.forPost('/post').thenReply(200);
      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
POST http://localhost:8080/post
Content-Type: application/json

< ./body.json
        `),
        0,
        {
          workingDir: __dirname,
        }
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].headers['content-type']).toBe('application/json');
      expect(await requests[0].body.getText()).toBe(body);
    });
  });
  describe('graphql', () => {
    it('query + operation + variables', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
POST  http://localhost:8080/graphql

query launchesQuery($limit: Int!){
  launchesPast(limit: $limit) {
    mission_name
    launch_date_local
    launch_site {
      site_name_long
    }
    rocket {
      rocket_name
      rocket_type
    }
    ships {
      name
      home_port
      image
    }
  }
}

{
    "limit": 10
}
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].url).toBe('http://localhost:8080/graphql');
      expect(await requests[0].body.getText()).toBe(
        '{"query":"query launchesQuery($limit: Int!){\\n  launchesPast(limit: $limit) {\\n    mission_name\\n    launch_date_local\\n    launch_site {\\n      site_name_long\\n    }\\n    rocket {\\n      rocket_name\\n      rocket_type\\n    }\\n    ships {\\n      name\\n      home_port\\n      image\\n    }\\n  }\\n}","operationName":"launchesQuery","variables":{"limit":10}}'
      );
    });
    it('query with fragment', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);
      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
fragment RocketParts on LaunchRocket {
  rocket_name
  first_stage {
    cores {
      flight
      core {
        reuse_count
        status
      }
    }
  }
}

POST http://localhost:8080/graphql HTTP/1.1
Content-Type: application/json


query launchesQuery($limit: Int!){
  launchesPast(limit: $limit) {
    mission_name
    launch_date_local
    launch_site {
      site_name_long
    }
    rocket {
      ...RocketParts
    }
  }
}

{
    "limit": 10
}
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].url).toBe('http://localhost:8080/graphql');
      expect(await requests[0].body.getText()).toBe(
        '{"query":"query launchesQuery($limit: Int!){\\n  launchesPast(limit: $limit) {\\n    mission_name\\n    launch_date_local\\n    launch_site {\\n      site_name_long\\n    }\\n    rocket {\\n      ...RocketParts\\n    }\\n  }\\n}\\nfragment RocketParts on LaunchRocket {\\n  rocket_name\\n  first_stage {\\n    cores {\\n      flight\\n      core {\\n        reuse_count\\n        status\\n      }\\n    }\\n  }\\n}","operationName":"launchesQuery","variables":{"limit":10}}'
      );
    });
    it('only query', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);
      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
POST http://localhost:8080/graphql
Content-Type: application/json

query company_query {
  company {
    coo
  }
}
        `),
        0,
        {
          workingDir: __dirname,
        }
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].url).toBe('http://localhost:8080/graphql');
      expect(await requests[0].body.getText()).toBe(
        '{"query":"query company_query {\\n  company {\\n    coo\\n  }\\n}","operationName":"company_query"}'
      );
    });
    it('imported query', async () => {
      initFileProvider({
        'graphql.gql': `
query launchesQuery($limit: Int!){
  launchesPast(limit: $limit) {
    mission_name
    launch_date_local
    launch_site {
      site_name_long
    }
    rocket {
      rocket_name
      rocket_type
    }
    ships {
      name
      home_port
      image
    }
  }
}
        `,
      });
      const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
POST http://localhost:8080/graphql
Content-Type: application/json

gql launchesQuery < ./graphql.gql

{
    "limit": 10
}
        `),
        0,
        {
          workingDir: __dirname,
        }
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].url).toBe('http://localhost:8080/graphql');
      expect(await requests[0].body.getText()).toBe(
        '{"query":"\\nquery launchesQuery($limit: Int!){\\n  launchesPast(limit: $limit) {\\n    mission_name\\n    launch_date_local\\n    launch_site {\\n      site_name_long\\n    }\\n    rocket {\\n      rocket_name\\n      rocket_type\\n    }\\n    ships {\\n      name\\n      home_port\\n      image\\n    }\\n  }\\n}\\n        ","operationName":"launchesQuery","variables":{"limit":10}}'
      );
    });
  });
  describe('metadata', () => {
    it('name + ref', async () => {
      initFileProvider();
      const refEndpoints = await localServer
        .forGet('/json')
        .thenReply(200, JSON.stringify({ foo: 'bar', test: 1 }), { 'content-type': 'application/json' });
      const mockedEndpoints = await localServer.forPost('/post').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
# @name foo
GET  http://localhost:8080/json


###
# @ref foo
POST http://localhost:8080/post?test={{foo.test}}

foo={{foo.foo}}

###
# @ref foo
POST http://localhost:8080/post?test={{foo.test}}

foo={{foo.foo}}
        `),
        0,
        {}
      );

      const [, ...httpRegions] = httpFile.httpRegions;
      const result = await send({
        httpFile,
        httpRegions,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests[0].url).toBe('http://localhost:8080/post?test=1');
      expect(await requests[0].body.getText()).toBe('foo=bar');
      const refRequests = await refEndpoints.getSeenRequests();
      expect(refRequests.length).toBe(1);
    });
    it('name + import + ref', async () => {
      initFileProvider({
        'import.http': `
# @name foo
GET  http://localhost:8080/json
        `,
      });
      await localServer
        .forGet('/json')
        .thenReply(200, JSON.stringify({ foo: 'bar', test: 1 }), { 'content-type': 'application/json' });
      const mockedEndpoints = await localServer.forPost('/post').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`

# @import ./import.http
###
# @ref foo
POST http://localhost:8080/post?test={{foo.test}}

foo={{foo.foo}}
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
        httpRegion: httpFile.httpRegions[1],
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests[0].url).toBe('http://localhost:8080/post?test=1');
      expect(await requests[0].body.getText()).toBe('foo=bar');
    });
    it('name + forceRef', async () => {
      initFileProvider();
      const refEndpoints = await localServer
        .forGet('/json')
        .thenReply(200, JSON.stringify({ foo: 'bar', test: 1 }), { 'content-type': 'application/json' });
      const mockedEndpoints = await localServer.forPost('/post').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
# @name foo
GET  http://localhost:8080/json


###
# @forceRef foo
POST http://localhost:8080/post?test={{foo.test}}

foo={{foo.foo}}


###
# @forceRef foo
POST http://localhost:8080/post?test={{foo.test}}

foo={{foo.foo}}
        `),
        0,
        {}
      );

      const [, ...httpRegions] = httpFile.httpRegions;
      const result = await send({
        httpFile,
        httpRegions,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests[0].url).toBe('http://localhost:8080/post?test=1');
      expect(await requests[0].body.getText()).toBe('foo=bar');
      const refRequests = await refEndpoints.getSeenRequests();
      expect(refRequests.length).toBe(2);
    });
    it('disabled', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer
        .forGet('/json')
        .thenReply(200, JSON.stringify({ foo: 'bar', test: 1 }), { 'content-type': 'application/json' });

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
# @disabled
GET  http://localhost:8080/json
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(0);
    });
    it('jwt', async () => {
      initFileProvider();
      await localServer.forGet('/json').thenReply(
        200,
        JSON.stringify({
          foo: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          test: 1,
        }),
        { 'content-type': 'application/json' }
      );

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
# @jwt foo
GET  http://localhost:8080/json

        `),
        0,
        {}
      );

      httpFile.hooks.onResponse.addHook('test', response => {
        expect(response?.parsedBody).toBeDefined();
        expect((response?.parsedBody as Record<string, unknown>)?.foo_parsed).toBeDefined();
      });

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
    });
    it('loop for of', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer.forGet('/json').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
{{
  exports.data = ['a', 'b', 'c'];
}}
###
# @loop for item of data
GET  http://localhost:8080/json?test={{item}}
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(3);
      expect(requests[0].url).toBe('http://localhost:8080/json?test=a');
      expect(requests[1].url).toBe('http://localhost:8080/json?test=b');
      expect(requests[2].url).toBe('http://localhost:8080/json?test=c');
    });
    it('loop for', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer.forGet('/json').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
# @loop for 3
GET  http://localhost:8080/json?test={{$index}}
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(3);
      expect(requests[0].url).toBe('http://localhost:8080/json?test=0');
      expect(requests[1].url).toBe('http://localhost:8080/json?test=1');
      expect(requests[2].url).toBe('http://localhost:8080/json?test=2');
    });
    it('loop while', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer.forGet('/json').thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
{{
  exports.expression = {
    index: 0,
  };
}}
###
# @loop while expression.index < 3
GET  http://localhost:8080/json?test={{expression.index++}}
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(3);
      expect(requests[0].url).toBe('http://localhost:8080/json?test=0');
      expect(requests[1].url).toBe('http://localhost:8080/json?test=1');
      expect(requests[2].url).toBe('http://localhost:8080/json?test=2');
    });
  });
  describe('variables', () => {
    it('file variables', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer
        .forGet('/json')
        .thenReply(200, JSON.stringify({ foo: 'bar', test: 1 }), { 'content-type': 'application/json' });

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
@foo=foo
@bar={{foo}}bar
GET  http://localhost:8080/json?bar={{bar}}
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests[0].url).toBe('http://localhost:8080/json?bar=foobar');
    });
    it('host', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer
        .forGet('/json')
        .thenReply(200, JSON.stringify({ foo: 'bar', test: 1 }), { 'content-type': 'application/json' });

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
@host=http://localhost:8080
GET  /json
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests[0].url).toBe('http://localhost:8080/json');
    });
    it('escape handlebar', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer
        .forPost('/post')
        .thenReply(200, JSON.stringify({ foo: 'bar', test: 1 }), { 'content-type': 'application/json' });

      const httpFileStore = new HttpFileStore();

      const escape = `\\{\\{title\\}\\}`;
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
POST  http://localhost:8080/post

<html>
<div>${escape}</div>
</html>
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(await requests[0].body.getText()).toBe('<html>\n<div>{{title}}</div>\n</html>');
    });
    it('basic auth', async () => {
      initFileProvider();
      const mockedEndpoints = await localServer
        .forGet('/json')
        .thenReply(200, JSON.stringify({ foo: 'bar', test: 1 }), { 'content-type': 'application/json' });

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
GET  http://localhost:8080/json
Authorization: Basic john:doe

###
GET  http://localhost:8080/json
Authorization: Basic john doe

        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(2);
      expect(requests[0].headers.authorization).toBe('Basic am9objpkb2U=');
      expect(requests[1].headers.authorization).toBe('Basic am9objpkb2U=');
    });
    it('digest auth', async () => {
      initFileProvider();
      const missingAuthEndpoints = await localServer
        .forGet('/json')
        .matching(request => !request.headers.authorization)
        .thenReply(401, null, {
          'www-authenticate':
            'Digest realm="json@localhost",qop="auth,auth-int",nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093",opaque="5ccc069c403ebaf9f0171e9517f40e41"',
        });
      const mockedEndpoints = await localServer
        .forGet('/json')
        .matching(request => !!request.headers.authorization)
        .thenReply(200);

      const httpFileStore = new HttpFileStore();
      const httpFile = await httpFileStore.getOrCreate(
        `any.http`,
        async () =>
          Promise.resolve(`
GET  http://localhost:8080/json
Authorization: Digest john doe
        `),
        0,
        {}
      );

      const result = await send({
        httpFile,
      });
      expect(result).toBeTruthy();
      const authMissingRequests = await missingAuthEndpoints.getSeenRequests();
      expect(authMissingRequests.length).toBe(1);
      const requests = await mockedEndpoints.getSeenRequests();
      expect(requests.length).toBe(1);
      expect(requests[0].headers.authorization).toBe(
        'Digest username="john", realm="json@localhost", nonce="dcd98b7102dd2f0e8b11d0f600bfb0c093", uri="/json", response="4d157d692f3e05a1cbe192ddbc427782", opaque="5ccc069c403ebaf9f0171e9517f40e41"'
      );
    });
  });
});
