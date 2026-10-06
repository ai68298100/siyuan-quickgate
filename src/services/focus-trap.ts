/**
 * 对话框焦点圈（L585 部分）：Tab 在容器内循环，不外逸到宿主界面。
 * 键盘可达性基线（R73-P0·键盘）的"确认框 focus trap"落地件；
 * 监听器挂在容器元素上，容器随对话框销毁移除时一并被 GC，无需手动卸载。
 */

const FOCUSABLE = 'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

function isFocusable(el: HTMLElement): boolean {
    if (el.hasAttribute("disabled")) return false;
    // display:none / fn__none 的元素 offsetParent 为 null——跳过不可见项
    return el.offsetParent !== null;
}

export function installFocusTrap(container: HTMLElement): void {
    container.addEventListener("keydown", (ev) => {
        const kev = ev as KeyboardEvent;
        if (kev.key !== "Tab") return;
        const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isFocusable);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = container.ownerDocument.activeElement;
        // 焦点已在容器外（程序化跳转等）——拉回圈内
        if (!active || !container.contains(active)) {
            kev.preventDefault();
            first.focus();
            return;
        }
        if (kev.shiftKey && active === first) {
            kev.preventDefault();
            last.focus();
        } else if (!kev.shiftKey && active === last) {
            kev.preventDefault();
            first.focus();
        }
    });
}
