import * as plugins from './plugins';
import { pluginStore } from './store';

pluginStore.core = plugins.registerCorePlugins;
pluginStore.eventSource = plugins.registerEventSourcePlugin;
pluginStore.grpc = plugins.registerGrpcPlugin;
pluginStore.intellij = plugins.registerIntellijPlugin;
pluginStore.injection = plugins.registerInjectionPlugin;
pluginStore.mqtt = plugins.registerMqttPlugin;
pluginStore.oauth2 = plugins.registerOAuth2Plugin;
pluginStore.websocket = plugins.registerWebsocketPlugin;
