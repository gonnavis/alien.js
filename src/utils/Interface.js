/**
 * @author pschroen / https://ufo.ai/
 */

import { Assets } from '../loaders/Assets.js';
import { EventEmitter } from './EventEmitter.js';

import { clearTween, delayedCall, getProperty, quickSetter, tween } from './Tween.js';

export class Interface {
    constructor(name, type = 'div', qualifiedName) {
        this.events = new EventEmitter();
        this.children = [];
        this.timeouts = [];

        if (typeof name === 'object' && name !== null) {
            this.element = name;
        } else {
            this.name = name;
            this.type = type;

            if (type === 'svg') {
                this.element = document.createElementNS('http://www.w3.org/2000/svg', qualifiedName || 'svg');
            } else {
                this.element = document.createElement(type);
            }

            if (typeof name === 'string') {
                if (name.charAt(0) === '.') {
                    this.element.className = name.substr(1);
                } else {
                    this.element.id = name;
                }
            }
        }

        this.element.object = this;

        this.setStyle = quickSetter(this.element, 'css');
        this.setAttribute = quickSetter(this.element, 'attr');
    }

    get(prop, unit) {
        return getProperty(this.element, prop, unit);
    }

    bounds() {
        if (!this.element) {
            return;
        }

        return this.element.getBoundingClientRect();
    }

    add(child) {
        if (!this.children) {
            return;
        }

        if (child.destroy) {
            this.children.push(child);

            child.parent = this;
        }

        if (child.element) {
            this.element.appendChild(child.element);
        } else if (child.nodeName) {
            this.element.appendChild(child);
        }

        return child;
    }

    remove(child) {
        if (!this.children) {
            return;
        }

        if (child.element) {
            child.element.parentNode.removeChild(child.element);
        } else if (child.nodeName) {
            child.parentNode.removeChild(child);
        }

        const index = this.children.indexOf(child);

        if (~index) {
            this.children.splice(index, 1);
        }
    }

    clone() {
        if (!this.element) {
            return;
        }

        return new Interface(this.element.cloneNode(true));
    }

    empty() {
        if (!this.element) {
            return;
        }

        for (let i = this.children.length - 1; i >= 0; i--) {
            if (this.children[i] && this.children[i].destroy) {
                this.children[i].destroy();
            }
        }

        this.children.length = 0;

        this.element.innerHTML = '';

        return this;
    }

    css(props) {
        if (!this.element) {
            return;
        }

        this.setStyle(props);

        return this;
    }

    attr(props) {
        if (!this.element) {
            return;
        }

        this.setAttribute(props);

        return this;
    }

    tween(props, time, ease, delay, complete, update) {
        return tween(this.element, props, time, ease, delay, complete, update);
    }

    clearTween() {
        clearTween(this.element);

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

    text(str) {
        if (!this.element) {
            return;
        }

        if (typeof str === 'undefined') {
            return this.element.textContent;
        } else {
            this.element.textContent = str;
        }

        return this;
    }

    html(str) {
        if (!this.element) {
            return;
        }

        if (typeof str === 'undefined') {
            return this.element.innerHTML;
        } else {
            this.element.innerHTML = str;
        }

        return this;
    }

    hide() {
        return this.css({ display: 'none' });
    }

    show() {
        return this.css({ clearProps: 'display' });
    }

    invisible() {
        return this.css({ visibility: 'hidden' });
    }

    visible() {
        return this.css({ clearProps: 'visibility' });
    }

    bg(path, backgroundSize = 'contain', backgroundPosition = 'center', backgroundRepeat = 'no-repeat') {
        path = Assets.getPath(path);

        const style = {
            backgroundImage: `url(${path})`,
            backgroundSize,
            backgroundPosition,
            backgroundRepeat
        };

        return this.css(style);
    }

    line(progress) {
        const length = this.element.getTotalLength();
        const dash = length * (progress || this.progress);
        const gap = length - dash;
        const offset = -length * (this.start + this.offset);

        const style = {
            strokeDasharray: `${dash},${gap}`,
            strokeDashoffset: offset
        };

        return this.css(style);
    }

    load(path) {
        path = Assets.getPath(path);

        const promise = fetch(path, Assets.options).then(response => {
            return response.text();
        }).then(str => {
            this.html(str);
        });

        return promise;
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

        this.element.object = null;

        for (const prop in this) {
            this[prop] = null;
        }

        return null;
    }
}
