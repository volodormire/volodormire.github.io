
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    const is_client = typeof window !== 'undefined';
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.0' }, detail), true));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.44.0 */

    const { isNaN: isNaN_1 } = globals;
    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let div1;
    	let div0;
    	let h10;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let h20;
    	let t5;
    	let img0;
    	let img0_src_value;
    	let t6;
    	let p0;
    	let t8;
    	let h11;
    	let t10;
    	let img1;
    	let img1_src_value;
    	let t11;
    	let br;
    	let t12;
    	let img2;
    	let img2_src_value;
    	let t13;
    	let h21;
    	let t15;
    	let h30;
    	let t17;
    	let p1;
    	let li0;
    	let t19;
    	let li1;
    	let t21;
    	let li2;
    	let t23;
    	let li3;
    	let t25;
    	let hr;
    	let t26;
    	let h31;
    	let t28;
    	let p2;
    	let li4;
    	let t30;
    	let b;
    	let li5;
    	let t32;
    	let img3;
    	let img3_src_value;
    	let t33;
    	let div2;
    	let h12;
    	let t35;
    	let h22;
    	let t37;
    	let p3;
    	let t39;
    	let div5;
    	let video;
    	let track;
    	let video_src_value;
    	let video_updating = false;
    	let video_animationframe;
    	let video_is_paused = true;
    	let t40;
    	let div4;
    	let progress;
    	let progress_value_value;
    	let t41;
    	let div3;
    	let span0;
    	let t42_value = format(/*time*/ ctx[1]) + "";
    	let t42;
    	let t43;
    	let span1;
    	let t44;
    	let t45_value = (/*paused*/ ctx[3] ? 'play' : 'pause') + "";
    	let t45;
    	let t46;
    	let t47;
    	let span2;
    	let t48_value = format(/*duration*/ ctx[2]) + "";
    	let t48;
    	let mounted;
    	let dispose;

    	function video_timeupdate_handler() {
    		cancelAnimationFrame(video_animationframe);

    		if (!video.paused) {
    			video_animationframe = raf(video_timeupdate_handler);
    			video_updating = true;
    		}

    		/*video_timeupdate_handler*/ ctx[8].call(video);
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			div1 = element("div");
    			div0 = element("div");
    			h10 = element("h1");
    			t0 = text("สวัสดีครับ ");
    			t1 = text(/*name*/ ctx[0]);
    			t2 = text("!");
    			t3 = space();
    			h20 = element("h2");
    			h20.textContent = "ศึกษาอยู่ที่โรงเรียนไตรพัฒน์";
    			t5 = space();
    			img0 = element("img");
    			t6 = space();
    			p0 = element("p");
    			p0.textContent = "สวัสดีครับ ผมนายกังสดาล เหมือนแม้นสกุล ในปัจจุบันผมกำลังศึกษาอยู่ที่โรงเรียนไตรพัฒน์ อยู่ชั้นมัธยมศึกษาปีที่ 4 ทุกคนอาจจะไม่คุ้นเคยกับชื่อโรงเรียนไตรพัฒน์เพราะโรงเรียนไตรพัฒน์เป็นโรงเรียนวอลดอร์ฟ โรงเรียนแนวการเรียนการสอนแบบวอลดอร์ฟ เป็นแนวการศึกษาที่บูรณาการวิชาการไปกับกิจกรรรมต่างๆ โดยมีครูคอยดูแลและอำนวยความสะดวก เน้นการจัดบรรยากาศในการเรียนการสอนที่เน้นความงดงามของธรรมชาติทั้งในกลางแจ้งและในห้องเรียน โดยเชื่อว่าช่วยให้เกิดการเรียนรู้ที่ดี เพื่อพัฒนาให้เด็กเป็นมนุษย์ที่มีบุคลิกภาพที่สมดุลกลมกลืนไปกับโลกและสิ่งแวดล้อม และได้ใช้พลังงานทุกด้านอย่างพอเหมาะ ทำให้ผมเป็นคนที่ค่อนข้างจะแข็งแรง และชอบกิจกรรม out door เช่นการเล่นเรือใบที่เป็นหนึ่งในวิชาเรียนของโรงเรียนนี้พวกผมและเพื่อนๆได้ไปเข้าค่ายเรียนเรือใบที่อำเภอสัตหีบ จังหวัดชลบุรี ซึ่งในค่ายนี้ผมก็ได้รับประกาศนียบัตร การเล่นใบขั้นสูง และการเล่นใบขั้นพื้นฐาน";
    			t8 = space();
    			h11 = element("h1");
    			h11.textContent = "------";
    			t10 = space();
    			img1 = element("img");
    			t11 = space();
    			br = element("br");
    			t12 = space();
    			img2 = element("img");
    			t13 = space();
    			h21 = element("h2");
    			h21.textContent = "ส่วนด้านงานอดิเรกของผมนั้น ผมชื่นชอบทั้งการเล่นกีฬาในร่มและนอกร่ม";
    			t15 = space();
    			h30 = element("h3");
    			h30.textContent = "กีฬานอกร่ม คือ";
    			t17 = space();
    			p1 = element("p");
    			li0 = element("li");
    			li0.textContent = "บาสเกตบอล";
    			t19 = space();
    			li1 = element("li");
    			li1.textContent = "ฟุตบอล";
    			t21 = space();
    			li2 = element("li");
    			li2.textContent = "เรือใบ";
    			t23 = space();
    			li3 = element("li");
    			li3.textContent = "แชร์บอล";
    			t25 = space();
    			hr = element("hr");
    			t26 = space();
    			h31 = element("h3");
    			h31.textContent = "กีฬาในร่ม คือ";
    			t28 = space();
    			p2 = element("p");
    			li4 = element("li");
    			li4.textContent = "ปิงปอง";
    			t30 = space();
    			b = element("b");
    			li5 = element("li");
    			li5.textContent = "E-sport";
    			t32 = space();
    			img3 = element("img");
    			t33 = space();
    			div2 = element("div");
    			h12 = element("h1");
    			h12.textContent = "E-sport";
    			t35 = space();
    			h22 = element("h2");
    			h22.textContent = "ผมได้รู้จักกีฬาE-sport";
    			t37 = space();
    			p3 = element("p");
    			p3.textContent = "ครั้งแรกจากเพื่อน ในชั้นเรียน หลังจากนั้นผมก็เริ่มสนใจกีฬาชนิดนี้มากยิ่งขึ้น เพราะว่ามันทำให้ผมได้ใช้เวลาร่วมกับเพื่อน และได้เจอสังคมใหม่ ถึงทุกคนจะมองว่าการเล่นเกมมันไม่ดีแต่ผมคิดว่าถ้าเราเลือกที่จะนำเกมมาใช้ให้เป็นประโยชน์ในชีวิตจริง ผมก็เชื่อว่าการเล่นเกมมีประโยชน์มากกว่าที่ทุกคนคิด";
    			t39 = space();
    			div5 = element("div");
    			video = element("video");
    			track = element("track");
    			t40 = space();
    			div4 = element("div");
    			progress = element("progress");
    			t41 = space();
    			div3 = element("div");
    			span0 = element("span");
    			t42 = text(t42_value);
    			t43 = space();
    			span1 = element("span");
    			t44 = text("click anywhere to ");
    			t45 = text(t45_value);
    			t46 = text(" / drag to seek");
    			t47 = space();
    			span2 = element("span");
    			t48 = text(t48_value);
    			attr_dev(h10, "class", "svelte-1y8vi2s");
    			add_location(h10, file, 55, 3, 1429);
    			attr_dev(h20, "class", "svelte-1y8vi2s");
    			add_location(h20, file, 56, 2, 1459);
    			attr_dev(div0, "class", "transbox svelte-1y8vi2s");
    			add_location(div0, file, 54, 2, 1403);
    			if (!src_url_equal(img0.src, img0_src_value = "image/1.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "");
    			attr_dev(img0, "width", "500");
    			add_location(img0, file, 58, 2, 1509);
    			attr_dev(p0, "class", "svelte-1y8vi2s");
    			add_location(p0, file, 59, 3, 1556);
    			attr_dev(h11, "class", "svelte-1y8vi2s");
    			add_location(h11, file, 60, 3, 2386);
    			if (!src_url_equal(img1.src, img1_src_value = "image/2.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "");
    			attr_dev(img1, "width", "500");
    			add_location(img1, file, 61, 3, 2405);
    			add_location(br, file, 61, 47, 2449);
    			if (!src_url_equal(img2.src, img2_src_value = "image/3.jpg")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "alt", "");
    			attr_dev(img2, "width", "500");
    			add_location(img2, file, 62, 3, 2457);
    			attr_dev(h21, "class", "svelte-1y8vi2s");
    			add_location(h21, file, 63, 2, 2503);
    			attr_dev(h30, "class", "svelte-1y8vi2s");
    			add_location(h30, file, 64, 3, 2581);
    			add_location(li0, file, 66, 4, 2616);
    			add_location(li1, file, 67, 4, 2639);
    			add_location(li2, file, 68, 4, 2659);
    			add_location(li3, file, 69, 4, 2679);
    			attr_dev(p1, "class", "svelte-1y8vi2s");
    			add_location(p1, file, 65, 3, 2608);
    			add_location(hr, file, 71, 2, 2706);
    			attr_dev(h31, "class", "svelte-1y8vi2s");
    			add_location(h31, file, 72, 3, 2714);
    			add_location(li4, file, 74, 4, 2748);
    			add_location(li5, file, 75, 7, 2771);
    			add_location(b, file, 75, 4, 2768);
    			attr_dev(p2, "class", "svelte-1y8vi2s");
    			add_location(p2, file, 73, 3, 2740);
    			attr_dev(div1, "class", "tk svelte-1y8vi2s");
    			add_location(div1, file, 53, 1, 1384);
    			if (!src_url_equal(img3.src, img3_src_value = "https://cdn-icons-png.flaticon.com/512/1408/1408901.png")) attr_dev(img3, "src", img3_src_value);
    			attr_dev(img3, "alt", "");
    			attr_dev(img3, "width", "300");
    			add_location(img3, file, 79, 1, 2810);
    			attr_dev(h12, "class", "svelte-1y8vi2s");
    			add_location(h12, file, 82, 2, 2921);
    			attr_dev(h22, "class", "svelte-1y8vi2s");
    			add_location(h22, file, 83, 2, 2940);
    			attr_dev(p3, "class", "svelte-1y8vi2s");
    			add_location(p3, file, 84, 3, 2975);
    			attr_dev(div2, "class", "game svelte-1y8vi2s");
    			add_location(div2, file, 81, 1, 2900);
    			attr_dev(track, "kind", "captions");
    			add_location(track, file, 97, 4, 3522);
    			if (!src_url_equal(video.src, video_src_value = "image/เกมต้น.mp4")) attr_dev(video, "src", video_src_value);
    			attr_dev(video, "class", "svelte-1y8vi2s");
    			if (/*duration*/ ctx[2] === void 0) add_render_callback(() => /*video_durationchange_handler*/ ctx[9].call(video));
    			add_location(video, file, 88, 2, 3287);
    			progress.value = progress_value_value = /*time*/ ctx[1] / /*duration*/ ctx[2] || 0;
    			attr_dev(progress, "class", "svelte-1y8vi2s");
    			add_location(progress, file, 101, 3, 3640);
    			attr_dev(span0, "class", "time svelte-1y8vi2s");
    			add_location(span0, file, 104, 4, 3713);
    			attr_dev(span1, "class", "svelte-1y8vi2s");
    			add_location(span1, file, 105, 4, 3758);
    			attr_dev(span2, "class", "time svelte-1y8vi2s");
    			add_location(span2, file, 106, 4, 3836);
    			attr_dev(div3, "class", "info svelte-1y8vi2s");
    			add_location(div3, file, 103, 3, 3690);
    			attr_dev(div4, "class", "controls svelte-1y8vi2s");
    			set_style(div4, "opacity", /*duration*/ ctx[2] && /*showControls*/ ctx[4] ? 1 : 0);
    			add_location(div4, file, 100, 2, 3562);
    			attr_dev(div5, "class", "svelte-1y8vi2s");
    			add_location(div5, file, 87, 1, 3279);
    			attr_dev(main, "class", "svelte-1y8vi2s");
    			add_location(main, file, 52, 0, 1376);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h10);
    			append_dev(h10, t0);
    			append_dev(h10, t1);
    			append_dev(h10, t2);
    			append_dev(div0, t3);
    			append_dev(div0, h20);
    			append_dev(div1, t5);
    			append_dev(div1, img0);
    			append_dev(div1, t6);
    			append_dev(div1, p0);
    			append_dev(div1, t8);
    			append_dev(div1, h11);
    			append_dev(div1, t10);
    			append_dev(div1, img1);
    			append_dev(div1, t11);
    			append_dev(div1, br);
    			append_dev(div1, t12);
    			append_dev(div1, img2);
    			append_dev(div1, t13);
    			append_dev(div1, h21);
    			append_dev(div1, t15);
    			append_dev(div1, h30);
    			append_dev(div1, t17);
    			append_dev(div1, p1);
    			append_dev(p1, li0);
    			append_dev(p1, t19);
    			append_dev(p1, li1);
    			append_dev(p1, t21);
    			append_dev(p1, li2);
    			append_dev(p1, t23);
    			append_dev(p1, li3);
    			append_dev(div1, t25);
    			append_dev(div1, hr);
    			append_dev(div1, t26);
    			append_dev(div1, h31);
    			append_dev(div1, t28);
    			append_dev(div1, p2);
    			append_dev(p2, li4);
    			append_dev(p2, t30);
    			append_dev(p2, b);
    			append_dev(b, li5);
    			append_dev(main, t32);
    			append_dev(main, img3);
    			append_dev(main, t33);
    			append_dev(main, div2);
    			append_dev(div2, h12);
    			append_dev(div2, t35);
    			append_dev(div2, h22);
    			append_dev(div2, t37);
    			append_dev(div2, p3);
    			append_dev(main, t39);
    			append_dev(main, div5);
    			append_dev(div5, video);
    			append_dev(video, track);
    			append_dev(div5, t40);
    			append_dev(div5, div4);
    			append_dev(div4, progress);
    			append_dev(div4, t41);
    			append_dev(div4, div3);
    			append_dev(div3, span0);
    			append_dev(span0, t42);
    			append_dev(div3, t43);
    			append_dev(div3, span1);
    			append_dev(span1, t44);
    			append_dev(span1, t45);
    			append_dev(span1, t46);
    			append_dev(div3, t47);
    			append_dev(div3, span2);
    			append_dev(span2, t48);

    			if (!mounted) {
    				dispose = [
    					listen_dev(video, "mousemove", /*handleMove*/ ctx[5], false, false, false),
    					listen_dev(video, "touchmove", prevent_default(/*handleMove*/ ctx[5]), false, true, false),
    					listen_dev(video, "mousedown", /*handleMousedown*/ ctx[6], false, false, false),
    					listen_dev(video, "mouseup", /*handleMouseup*/ ctx[7], false, false, false),
    					listen_dev(video, "timeupdate", video_timeupdate_handler),
    					listen_dev(video, "durationchange", /*video_durationchange_handler*/ ctx[9]),
    					listen_dev(video, "play", /*video_play_pause_handler*/ ctx[10]),
    					listen_dev(video, "pause", /*video_play_pause_handler*/ ctx[10])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*name*/ 1) set_data_dev(t1, /*name*/ ctx[0]);

    			if (!video_updating && dirty & /*time*/ 2 && !isNaN_1(/*time*/ ctx[1])) {
    				video.currentTime = /*time*/ ctx[1];
    			}

    			video_updating = false;

    			if (dirty & /*paused*/ 8 && video_is_paused !== (video_is_paused = /*paused*/ ctx[3])) {
    				video[video_is_paused ? "pause" : "play"]();
    			}

    			if (dirty & /*time, duration*/ 6 && progress_value_value !== (progress_value_value = /*time*/ ctx[1] / /*duration*/ ctx[2] || 0)) {
    				prop_dev(progress, "value", progress_value_value);
    			}

    			if (dirty & /*time*/ 2 && t42_value !== (t42_value = format(/*time*/ ctx[1]) + "")) set_data_dev(t42, t42_value);
    			if (dirty & /*paused*/ 8 && t45_value !== (t45_value = (/*paused*/ ctx[3] ? 'play' : 'pause') + "")) set_data_dev(t45, t45_value);
    			if (dirty & /*duration*/ 4 && t48_value !== (t48_value = format(/*duration*/ ctx[2]) + "")) set_data_dev(t48, t48_value);

    			if (dirty & /*duration, showControls*/ 20) {
    				set_style(div4, "opacity", /*duration*/ ctx[2] && /*showControls*/ ctx[4] ? 1 : 0);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function format(seconds) {
    	if (isNaN(seconds)) return '...';
    	const minutes = Math.floor(seconds / 60);
    	seconds = Math.floor(seconds % 60);
    	if (seconds < 10) seconds = '0' + seconds;
    	return `${minutes}:${seconds}`;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { name } = $$props;

    	// These values are bound to properties of the video
    	let time = 0;

    	let duration;
    	let paused = true;
    	let showControls = true;
    	let showControlsTimeout;

    	// Used to track time of last mouse down event
    	let lastMouseDown;

    	function handleMove(e) {
    		// Make the controls visible, but fade out after
    		// 2.5 seconds of inactivity
    		clearTimeout(showControlsTimeout);

    		showControlsTimeout = setTimeout(() => $$invalidate(4, showControls = false), 2500);
    		$$invalidate(4, showControls = true);
    		if (!duration) return; // video not loaded yet
    		if (e.type !== 'touchmove' && !(e.buttons & 1)) return; // mouse not down

    		const clientX = e.type === 'touchmove'
    		? e.touches[0].clientX
    		: e.clientX;

    		const { left, right } = this.getBoundingClientRect();
    		$$invalidate(1, time = duration * (clientX - left) / (right - left));
    	}

    	// we can't rely on the built-in click event, because it fires
    	// after a drag — we have to listen for clicks ourselves
    	function handleMousedown(e) {
    		lastMouseDown = new Date();
    	}

    	function handleMouseup(e) {
    		if (new Date() - lastMouseDown < 300) {
    			if (paused) e.target.play(); else e.target.pause();
    		}
    	}

    	const writable_props = ['name'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function video_timeupdate_handler() {
    		time = this.currentTime;
    		$$invalidate(1, time);
    	}

    	function video_durationchange_handler() {
    		duration = this.duration;
    		$$invalidate(2, duration);
    	}

    	function video_play_pause_handler() {
    		paused = this.paused;
    		$$invalidate(3, paused);
    	}

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		name,
    		time,
    		duration,
    		paused,
    		showControls,
    		showControlsTimeout,
    		lastMouseDown,
    		handleMove,
    		handleMousedown,
    		handleMouseup,
    		format
    	});

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('time' in $$props) $$invalidate(1, time = $$props.time);
    		if ('duration' in $$props) $$invalidate(2, duration = $$props.duration);
    		if ('paused' in $$props) $$invalidate(3, paused = $$props.paused);
    		if ('showControls' in $$props) $$invalidate(4, showControls = $$props.showControls);
    		if ('showControlsTimeout' in $$props) showControlsTimeout = $$props.showControlsTimeout;
    		if ('lastMouseDown' in $$props) lastMouseDown = $$props.lastMouseDown;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		time,
    		duration,
    		paused,
    		showControls,
    		handleMove,
    		handleMousedown,
    		handleMouseup,
    		video_timeupdate_handler,
    		video_durationchange_handler,
    		video_play_pause_handler
    	];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !('name' in props)) {
    			console.warn("<App> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'ผมนายกังสดาล เหมือนแม้นสกุล'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
