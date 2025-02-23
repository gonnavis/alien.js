/**
 * @author pschroen / https://ufo.ai/
 */

import { EventEmitter } from './EventEmitter.js';

import { clearTween, delayedCall, tween } from './Tween.js';

export class Component {
    constructor() {
        this.events = new EventEmitter();
        this.children = [];
        this.timeouts = [];
    }

    add(child) {
        if (!this.children) {
            return;
        }

        if (child.destroy) {
            this.children.push(child);

            child.parent = this;
        }

        if (this.group && this.group.isObject3D) {
            if (child.group && child.group.isObject3D) {
                this.group.add(child.group);
            } else if (child.isObject3D) {
                this.group.add(child);
            }
        }

        return child;
    }

    remove(child) {
        if (!this.children) {
            return;
        }

        if (this.group && this.group.isObject3D) {
            if (child.group && child.group.isObject3D) {
                this.group.remove(child.group);
            } else if (child.isObject3D) {
                this.group.remove(child);
            }
        }

        const index = this.children.indexOf(child);

        if (~index) {
            this.children.splice(index, 1);
        }
    }

    tween(props, time, ease, delay, complete, update) {
        return tween(this, props, time, ease, delay, complete, update);
    }

    clearTween() {
        clearTween(this);

        return this;
    }

    delayedCall(time, callback, ...params) {
        if (!this.timeouts) {
            return;
        }

        const timeout = delayedCall(time, () => {
            this.clearTimeout(timeout);

            callback(...params);
        });

        this.timeouts.push(timeout);

        return timeout;
    }

    clearTimeout(timeout) {
        if (!this.timeouts) {
            return;
        }

        clearTween(timeout);

        const index = this.timeouts.indexOf(timeout);

        if (~index) {
            this.timeouts.splice(index, 1);
        }
    }

    clearTimeouts() {
        if (!this.timeouts) {
            return;
        }

        for (let i = this.timeouts.length - 1; i >= 0; i--) {
            this.clearTimeout(this.timeouts[i]);
        }

        this.timeouts.length = 0;
    }

    destroy() {
        if (!this.children) {
            return;
        }

        if (this.parent && this.parent.remove) {
            this.parent.remove(this);
        }

        this.clearTimeouts();
        this.clearTween();

        this.events.destroy();

        for (let i = this.children.length - 1; i >= 0; i--) {
            if (this.children[i] && this.children[i].destroy) {
                this.children[i].destroy();
            }
        }

        for (const prop in this) {
            this[prop] = null;
        }

        return null;
    }
}
