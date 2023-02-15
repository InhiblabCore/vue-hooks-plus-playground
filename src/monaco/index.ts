import { getCurrentInstance, onMounted, watch } from 'vue'
import * as monaco from 'monaco-editor'
import { createSingletonPromise } from '@antfu/utils'
/* __imports__ */

import vueuseTypes from '@vueuse/core/index.d.ts?raw'
import vueTypes from '@vue/runtime-core/dist/runtime-core.d.ts?raw'
import vhpTypes from '@vue-hooks-plus/types/types/index.d.ts?raw'

import { orchestrator } from '~/orchestrator'

const setup = createSingletonPromise(async () => {
	monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
		...monaco.languages.typescript.javascriptDefaults.getCompilerOptions(),
		noUnusedLocals: false,
		noUnusedParameters: false,
		allowUnreachableCode: true,
		allowUnusedLabels: true,
		strict: false,
		allowJs: true,
	})

	const registered: string[] = ['vue']

	monaco.languages.typescript.javascriptDefaults.addExtraLib(
		`
    declare module 'vue' {  ${vueTypes}  }
  `,
		'ts:vue'
	)

	vhpTypes.replace(
		`import { ComputedRef } from 'vue';
import Cookies from 'js-cookie';
import { createApp } from 'vue';
import type { DebouncedFunc } from 'lodash';
import { DeepReadonly } from 'vue';

import { UnwrapNestedRefs } from 'vue';
import { UnwrapRef } from 'vue';
import { VueElement } from 'vue';
import { WatchSource } from 'vue';`,
		''
	)

	const replaceType = ` 
  export declare class VueElement extends BaseClass {
    private _def;
    private _props;
    /* Excluded from this release type: _instance */
    private _connected;
    private _resolved;
    private _numberProps;
    private _styles?;
    constructor(_def: InnerComponentDef, _props?: Record<string, any>, hydrate?: RootHydrateFunction);
    connectedCallback(): void;
    disconnectedCallback(): void;
    /**
     * resolve inner component definition (handle possible async component)
     */
    private _resolveDef;
    private _resolveProps;
    protected _setAttr(key: string): void;
    /* Excluded from this release type: _getProp */
    /* Excluded from this release type: _setProp */
    private _update;
    private _createVNode;
    private _applyStyles;
}

declare type BaseTypes = string | number | boolean;

declare type Builtin = Primitive | Function | Date | Error | RegExp;

declare type CollectionTypes = IterableCollections | WeakCollections;
  declare const ShallowReactiveMarker: unique symbol;
  export declare type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>;

export declare type UnwrapRef<T> = T extends ShallowRef<infer V> ? V : T extends Ref<infer V> ? UnwrapRefSimple<V> : UnwrapRefSimple<T>;

declare type UnwrapRefSimple<T> = T extends Function | CollectionTypes | BaseTypes | Ref | RefUnwrapBailTypes[keyof RefUnwrapBailTypes] | {
    [RawSymbol]?: true;
} ? T : T extends ReadonlyArray<any> ? {
    [K in keyof T]: UnwrapRefSimple<T[K]>;
} : T extends object & {
    [ShallowReactiveMarker]?: never;
} ? {
    [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>;
} : T;
  declare interface ReadonlyMap<K, V> {
    forEach(callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: any): void;
    get(key: K): V | undefined;
    has(key: K): boolean;
    readonly size: number;
}
  declare type Builtin = Primitive | Function | Date | Error | RegExp;
  declare interface Ref<T = any> { value: T; }
  declare type Cookies = any
  declare type createApp = any
  declare  interface DebouncedFunc<T extends (...args: any[]) => any> {
        /**
         * Call the original function, but applying the debounce rules.
         *
         * If the debounced function can be run immediately, this calls it and returns its return
         * value.
         *
         * Otherwise, it returns the return value of the last invocation, or undefined if the debounced
         * function was not invoked yet.
         */
        (...args: Parameters<T>): ReturnType<T> | undefined;

        /**
         * Throw away any pending invocation of the debounced function.
         */
        cancel(): void;

        /**
         * If there is a pending invocation of the debounced function, invoke it immediately and return
         * its return value.
         *
         * Otherwise, return the value from the last invocation, or undefined if the debounced function
         * was never invoked.
         */
        flush(): ReturnType<T> | undefined;
    }
    export declare type DeepReadonly<T> = T extends Builtin ? T : T extends Map<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> : T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> : T extends WeakMap<infer K, infer V> ? WeakMap<DeepReadonly<K>, DeepReadonly<V>> : T extends Set<infer U> ? ReadonlySet<DeepReadonly<U>> : T extends ReadonlySet<infer U> ? ReadonlySet<DeepReadonly<U>> : T extends WeakSet<infer U> ? WeakSet<DeepReadonly<U>> : T extends Promise<infer U> ? Promise<DeepReadonly<U>> : T extends Ref<infer U> ? Readonly<Ref<DeepReadonly<U>>> : T extends {} ? {
    readonly [K in keyof T]: DeepReadonly<T[K]>;
} : Readonly<T>;

export declare type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);

`

	monaco.languages.typescript.javascriptDefaults.addExtraLib(
		`
    declare module 'vue-hooks-plus' {
      ${replaceType}
      ${vhpTypes}
  }
  `,
		'ts:vue'
	)

	watch(
		() => orchestrator.packages,
		() => {
			orchestrator.packages.forEach((pack) => {
				if (registered.includes(pack.name)) return

				registered.push(pack.name)
				monaco.languages.typescript.javascriptDefaults.addExtraLib(
					`
        declare module '${pack.name}' {
          let x: any;
          export = x;
        }
      `,
					pack.name
				)
			})
		},
		{ immediate: true }
	)

	await Promise.all([
		// load workers
		(async () => {
			const [
				{ default: EditorWorker },
				{ default: HtmlWorker },
				{ default: TsWorker },
			] = await Promise.all([
				import('monaco-editor/esm/vs/editor/editor.worker?worker'),
				import('./languages/html/html.worker?worker'),
				import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
			])

			// @ts-expect-error
			window.MonacoEnvironment = {
				getWorker(_: any, label: string) {
					if (label === 'html' || label === 'handlebars' || label === 'razor')
						return new HtmlWorker()
					if (label === 'typescript' || label === 'javascript')
						return new TsWorker()
					return new EditorWorker()
				},
			}
		})(),
	])

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const injection_arg = monaco

	/* __async_injections__ */

	if (getCurrentInstance())
		await new Promise<void>((resolve) => onMounted(resolve))

	return { monaco }
})

export default setup

setup()
