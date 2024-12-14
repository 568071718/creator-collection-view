import { _decorator, Component, Enum, Event, EventMouse, EventTouch, instantiate, log, Mask, math, Node, NodeEventType, NodePool, Prefab, ScrollView, UIOpacity, UITransform, ValueType } from 'cc';
const { ccclass, property, executionOrder, disallowMultiple, help } = _decorator;

const _vec3Out = new math.Vec3()
const _scroll_view_visible_rect = new math.Rect()
const _recycleInvisibleNodes_realFrame = new math.Rect()

type _yx_readonly_deep<T> = {
    readonly [P in keyof T]: T[P] extends Record<string, any> ? _yx_readonly_deep<T[P]> : T[P];
};

/**
 * 定义列表的滚动方向  
 */
enum _yx_collection_view_scroll_direction {
    /**
     * 水平滚动
     */
    HORIZONTAL,

    /**
     * 垂直滚动
     */
    VERTICAL,
}
Enum(_yx_collection_view_scroll_direction)

/**
 * 列表节点加载模式
 */
enum _yx_collection_view_list_mode {
    /**
     * 根据列表显示范围加载需要的节点，同类型的节点会进行复用  
     * 优点: 控制总节点数量，不会创建大量节点  
     * 缺点: 因为有复用逻辑，节点内容会频繁更新，cell 更新业务比较重的话列表会抖动，例如 Label (NONE) 很多的节点  
     */
    RECYCLE,

    /**
     * 直接预加载所有的节点，处于列表显示范围外的节点透明化处理  
     * 优点: 避免 cell 频繁更新，优化大量 Label (NONE) 场景下的卡顿问题  
     * 缺点: 会实例化所有节点，并非真正的虚拟列表，仅仅是把显示范围外的节点透明了，如果列表数据量很大仍然会卡  
     */
    PRELOAD,
}
Enum(_yx_collection_view_list_mode)

/**
 * 定义通过编辑器注册节点时的结构体
 */
@ccclass(`_yx_editor_register_cell_info`)
class _yx_editor_register_cell_info {
    @property({ type: Prefab, tooltip: `cell 节点预制体，必须配置` })
    prefab: Prefab = null

    @property({ tooltip: `节点重用标识符，必须配置` })
    identifier: string = ``

    @property({ tooltip: `节点挂载的自定义组件\n如果需要监听 NodePool 的重用/回收事件，确保你的自定义组件已经实现了 YXCollectionViewCell 接口并配置此属性为你的自定义组件名\n如果不需要，可以忽略此配置` })
    comp: string = ``
}

/**
 * 表示索引的对象
 */
@ccclass(`YXIndexPath`)
export class YXIndexPath extends ValueType {
    public static ZERO: Readonly<YXIndexPath> = new YXIndexPath(0, 0)
    /**
     * 区索引
     */
    section: number = 0
    /**
     * 单元格在区内的位置
     */
    item: number = 0
    set row(value: number) { this.item = value }
    get row(): number { return this.item }
    constructor(section: number, item: number) {
        super()
        this.section = section
        this.item = item
    }
    clone(): YXIndexPath {
        return new YXIndexPath(this.section, this.item)
    }
    equals(other: YXIndexPath): boolean {
        return (this.section == other.section && this.item == other.item)
    }
    set(other: YXIndexPath): void {
        this.section = other.section
        this.item = other.item
    }
    toString(): string {
        return `${this.section} - ${this.item}`
    }
}

/**
 * 表示边距的对象
 */
@ccclass(`YXEdgeInsets`)
export class YXEdgeInsets extends ValueType {
    public static ZERO: Readonly<YXEdgeInsets> = new YXEdgeInsets(0, 0, 0, 0)
    top: number
    left: number
    bottom: number
    right: number
    constructor(top: number, left: number, bottom: number, right: number) {
        super()
        this.top = top
        this.left = left
        this.bottom = bottom
        this.right = right
    }
    clone(): YXEdgeInsets {
        return new YXEdgeInsets(this.top, this.left, this.bottom, this.right)
    }
    equals(other: YXEdgeInsets): boolean {
        return (this.top == other.top && this.left == other.left && this.bottom == other.bottom && this.right == other.right)
    }
    set(other: YXEdgeInsets): void {
        this.top = other.top
        this.left = other.left
        this.bottom = other.bottom
        this.right = other.right
    }
    toString(): string {
        return `[ ${this.top}, ${this.left}, ${this.bottom}, ${this.right} ]`
    }
}

/**
 * 私有组件
 * cell 节点添加到 YXCollectionView 上时，自动挂载此组件，用来记录一些实时参数
 */
class _cell_ extends Component {
    /**
     * 此节点是通过哪个标识符创建的
     */
    identifier: string

    /**
     * 此节点目前绑定的布局属性
     */
    attributes: YXLayoutAttributes
}

/**
 * 私有组件
 * 内部滚动视图组件
 * https://github.com/cocos/cocos-engine/blob/v3.8.0/cocos/ui/scroll-view.ts
 */
class _scroll_view extends ScrollView {

    protected _yx_scroll_offset_on_touch_start: math.Vec2 = null
    _yx_startAttenuatingAutoScrollTargetOffset: (touchMoveVelocity: math.Vec3, startOffset: math.Vec2, originTargetOffset: math.Vec2, originScrollTime: number) => { offset: math.Vec2; time?: number; attenuated?: boolean; } = null

    /**
     * 鼠标滚轮
     */
    protected _onMouseWheel(event: EventMouse, captureListeners?: Node[]): void {
        const comp = this.node.getComponent(YXCollectionView)
        if (comp == null) { return }
        if (comp.scrollEnabled == false) { return }
        if (comp.wheelScrollEnabled == false) { return }
        super._onMouseWheel(event, captureListeners)
    }

    /**
     * 准备开始惯性滚动  
     * @param initialVelocity 手势速度  
     */
    protected _startAttenuatingAutoScroll(deltaMove: math.Vec3, initialVelocity: math.Vec3) {
        const targetDelta = deltaMove.clone();
        targetDelta.normalize();
        if (this._content && this.view) {
            const contentSize = this._content._uiProps.uiTransformComp!.contentSize;
            const scrollViewSize = this.view.contentSize;

            const totalMoveWidth = (contentSize.width - scrollViewSize.width);
            const totalMoveHeight = (contentSize.height - scrollViewSize.height);

            const attenuatedFactorX = this._calculateAttenuatedFactor(totalMoveWidth);
            const attenuatedFactorY = this._calculateAttenuatedFactor(totalMoveHeight);

            targetDelta.x = targetDelta.x * totalMoveWidth * (1 - this.brake) * attenuatedFactorX;
            targetDelta.y = targetDelta.y * totalMoveHeight * attenuatedFactorY * (1 - this.brake);
            targetDelta.z = 0;
        }

        const originalMoveLength = deltaMove.length();
        let factor = targetDelta.length() / originalMoveLength;
        targetDelta.add(deltaMove);

        if (this.brake > 0 && factor > 7) {
            factor = Math.sqrt(factor);
            const clonedDeltaMove = deltaMove.clone();
            clonedDeltaMove.multiplyScalar(factor);
            targetDelta.set(clonedDeltaMove);
            targetDelta.add(deltaMove);
        }

        let time = this._calculateAutoScrollTimeByInitialSpeed(initialVelocity.length());
        if (this.brake > 0 && factor > 3) {
            factor = 3;
            time *= factor;
        }

        if (this.brake === 0 && factor > 1) {
            time *= factor;
        }

        // 当自定义了滚动停留位置时，以自定义的停留位置为准  
        if (this._yx_startAttenuatingAutoScrollTargetOffset) {
            const originTargetOffset = this.getScrollOffset()
            originTargetOffset.x += targetDelta.x
            originTargetOffset.y += targetDelta.y
            let hookValue = this._yx_startAttenuatingAutoScrollTargetOffset(initialVelocity, this._yx_scroll_offset_on_touch_start, originTargetOffset, time)
            if (hookValue) {
                const hookOffset = hookValue.offset
                const hookTime = hookValue.time || time
                const hookAttenuated = hookValue.attenuated || true
                if (hookOffset) {
                    this.scrollToOffset(hookOffset, hookTime, hookAttenuated)
                    return
                }
            }
        }

        // 走默认行为  
        this._startAutoScroll(targetDelta, time, true);
    }

    protected _onTouchBegan(event: EventTouch, captureListeners?: Node[]): void {
        if (this.node.getComponent(YXCollectionView).scrollEnabled == false) { return }

        // 记录开始滚动时的偏移量  
        let offset = this.getScrollOffset()
        offset.x = - offset.x
        this._yx_scroll_offset_on_touch_start = offset

        let nodes: Node[] = [event.target]
        if (captureListeners) { nodes = nodes.concat(captureListeners) }
        for (let index = 0; index < nodes.length; index++) {
            const element = nodes[index];
            // 清空滚动节点标记
            element[`_yx_scroll_target`] = null
        }
        super._onTouchBegan(event, captureListeners)
    }

    protected _onTouchMoved(event: EventTouch, captureListeners?: Node[]): void {
        if (this.node.getComponent(YXCollectionView).scrollEnabled == false) { return }
        // 处理嵌套冲突，每次只滚动需要滚动的列表
        let scrollTarget = this._yxGetScrollTarget(event, captureListeners)
        if (this.node === scrollTarget) {
            super._onTouchMoved(event, captureListeners)
        }
    }
    protected _onTouchCancelled(event: EventTouch, captureListeners?: Node[]): void {
        super._onTouchCancelled(event, captureListeners)
    }
    protected _onTouchEnded(event: EventTouch, captureListeners?: Node[]): void {
        super._onTouchEnded(event, captureListeners)
    }

    protected _hasNestedViewGroup(event: Event, captureListeners?: Node[]): boolean {
        // 直接把所有的列表都标记为可滑动，具体滑动哪一个，去 _onTouchMoved 判断
        return false
    }

    protected _stopPropagationIfTargetIsMe(event: Event): void {
        if (this._touchMoved) {
            event.propagationStopped = true;
            return
        }
        super._stopPropagationIfTargetIsMe(event)
    }

    /**
     * 获取本次滑动是要滑动哪个列表
     */
    private _yxGetScrollTarget(event: EventTouch, captureListeners?: Node[]): Node {
        // 尝试获取本次已经确定了的滚动节点
        let cache = event.target[`_yx_scroll_target`]
        if (cache) {
            return cache
        }

        let nodes: Node[] = [event.target]
        if (captureListeners) {
            nodes = nodes.concat(captureListeners)
        }
        if (nodes.length == 1) { return nodes[0] } // 无需处理冲突

        let touch = event.touch;
        let deltaMove = touch.getLocation().subtract(touch.getStartLocation());
        let x = Math.abs(deltaMove.x)
        let y = Math.abs(deltaMove.y)
        let distance = Math.abs(x - y)
        if (distance < 5) {
            return null // 不足以计算出方向
        }
        /** @todo 边界检测，滑动到边缘时滑动事件交给其他可滑动列表 */

        let result = null
        for (let index = 0; index < nodes.length; index++) {
            const element = nodes[index];
            let scrollComp = element.getComponent(_scroll_view)
            if (scrollComp) {
                let collectionView = element.getComponent(YXCollectionView)
                if (collectionView && collectionView.scrollEnabled == false) { continue } // 不支持滚动
                if (result == null) { result = element } // 取第一个滚动组件作为默认响应者
                if (scrollComp.horizontal && scrollComp.vertical) { continue } // 全方向滚动暂时不处理
                if (!scrollComp.horizontal && !scrollComp.vertical) { continue } // 不支持滚动的也不处理
                if (scrollComp.horizontal && x > y) {
                    result = element
                    break
                }
                if (scrollComp.vertical && y > x) {
                    result = element
                    break
                }
            }
        }

        // 给所有捕获到的节点都保存一份，方便任意一个节点都可以读到
        if (result) {
            for (let index = 0; index < nodes.length; index++) {
                const element = nodes[index];
                element[`_yx_scroll_target`] = result
            }
        }
        return result
    }
}

/**
 * 节点的布局属性
 */
export class YXLayoutAttributes {
    /**
     * 节点索引
     */
    get indexPath(): YXIndexPath { return this._indexPath }
    private _indexPath: YXIndexPath = null
    constructor(indexPath: YXIndexPath) {
        this._indexPath = indexPath
    }

    /**
     * 节点在滚动视图中的位置和大小属性
     * origin 属性表示节点在父视图坐标系中的左上角的位置，size 属性表示节点的宽度和高度
     */
    frame: math.Rect = null

    /**
     * 节点层级
     * 越小会越早的添加到滚动视图上
     * https://docs.cocos.com/creator/manual/zh/ui-system/components/editor/ui-transform.html?h=uitrans
     * 备注: 内部暂时是通过节点的 siblingIndex 实现的，如果自定义 layout 有修改这个值的需求，需要重写 layout 的 @shouldUpdateAttributesZIndex 方法，默认情况下会忽略这个配置
     */
    zIndex: number = 0

    /**
     * 节点透明度
     * 备注: 内部通过 UIOpacity 组件实现，会修改节点 UIOpacity 组件的 opacity 值，如果自定义 layout 有修改这个值的需求，需要重写 layout 的 @shouldUpdateAttributesOpacity 方法，默认情况下会忽略这个配置
     */
    opacity: number = null

    /**
     * 节点变换 - 缩放
     */
    scale: math.Vec3 = null

    /**
     * 节点变换 - 平移
     */
    offset: math.Vec3 = null

    /**
     * 节点变换 - 旋转
     * 备注: 3D 变换似乎需要透视相机???
     */
    eulerAngles: math.Vec3 = null
}

/**
 * 布局规则
 * 这里只是约定出了一套接口，内部只是一些基础实现，具体布局方案通过子类重载去实现
 */
export abstract class YXLayout {
    constructor() { }

    /**
     * @required
     * 整个滚动区域大小
     * 需要在 @prepare 内初始化
     */
    contentSize: math.Size = math.Size.ZERO

    /**
     * @required
     * 所有元素的布局属性
     * 需要在 @prepare 内初始化
     */
    attributes: YXLayoutAttributes[] = []

    /**
     * @required
     * 子类重写实现布局方案
     * 注意: 必须初始化滚动区域大小并赋值给 @contentSize 属性
     * 注意: 必须初始化所有的元素布局属性，并保存到 @attributes 数组
     * 可选: 根据 collectionView 的 scrollDirection 支持不同的滚动方向
     */
    abstract prepare(collectionView: YXCollectionView): void

    /**
     * @optional
     * 列表在首次更新数据后会执行这个方法
     * 在这个方法里设置滚动视图的初始偏移量
     */
    initOffset(collectionView: YXCollectionView) { }

    /**
     * @optional  
     * 当一次手势拖动结束后会立即调用此方法，通过重写这个方法可以定制列表最终停留的位置  
     * 
     * @param collectionView 列表组件  
     * @param touchMoveVelocity 手势速度  
     * @param startOffset 此次手势开始时列表的偏移位置  
     * @param originTargetOffset 接下来将要自动滚动到的位置  
     * @param originScrollDuration 接下来的惯性滚动持续时间  
     * @returns 可以返回 null ，返回 null 执行默认的惯性滚动逻辑  
     * 
     * 另外关于返回值的字段说明  
     * @param offset 这个字段表示列表本次滚动结束时期望停留的位置，一旦返回了这个字段，列表最终将会停留至返回的这个位置    
     * @param time 可选，默认为 originScrollDuration，这个字段表示自动滚动至期望停留位置需要的时间  
     * @param attenuated 可选，默认为 true，这个字段表示惯性滚动速度是否衰减  
     */
    targetOffset(collectionView: YXCollectionView, touchMoveVelocity: math.Vec3, startOffset: math.Vec2, originTargetOffset: math.Vec2, originScrollDuration: number): { offset: math.Vec2; time?: number; attenuated?: boolean; } | null { return null }

    /**
     * @optional
     * 列表每次滚动结束后会调用此方法
     * @param collectionView 
     */
    onScrollEnded(collectionView: YXCollectionView) { }

    /**
     * @optional
     * 返回区域内可见的节点属性，并实时的调整这些节点变换效果 (如果在这个方法里调整了节点变换属性，需要重写 shouldUpdateAttributesForBoundsChange 以支持实时变换)
     * 根据实际的布局情况，计算出当前屏幕内需要显示的布局属性
     * 这个方法会直接影响到列表的性能，如果在自定义的时候对性能要求不高(比如明确知道数据量不多的情况下)，可以忽略此方法 (默认会检查所有的布局属性并返回所有的处于可见范围内的单元格布局属性)
     * @param rect 当前滚动视图的可见区域
     */
    layoutAttributesForElementsInRect(rect: math.Rect, collectionView: YXCollectionView): YXLayoutAttributes[] {
        let result = []
        for (let index = 0; index < this.attributes.length; index++) {
            let attr = this.attributes[index]
            if (rect.intersects(attr.frame) == true) {
                result.push(attr)
            }
        }
        return result
    }

    /**
     * @optional
     * 通过索引查找布局属性，默认 Array.find()
     * @param indexPath 
     * @param collectionView 
     */
    layoutAttributesForItemAtIndexPath(indexPath: YXIndexPath, collectionView: YXCollectionView): YXLayoutAttributes {
        return this.attributes.find((a) => a.indexPath.equals(indexPath))
    }

    /**
     * @optional
     * YXCollectionView 在调用 @scrollTo 方法时会触发这个方法，如果实现了这个方法，最终的滚动停止位置以这个方法返回的为准
     * @param indexPath 
     * @returns 滚动视图偏移位置
     */
    scrollTo(indexPath: YXIndexPath, collectionView: YXCollectionView): math.Vec2 { return null }

    /**
     * @optional
     * @see YXLayoutAttributes.zIndex
     * @returns 
     */
    shouldUpdateAttributesZIndex(): boolean { return false }

    /**
     * @optional
     * @see YXLayoutAttributes.opacity
     * @returns 
     */
    shouldUpdateAttributesOpacity(): boolean { return false }

    /**
     * @optional
     * 此布局下的节点，是否需要实时更新变换效果
     * @returns 返回 true 会忽略 YXCollectionView 的 frameInterval 设置，强制在滚动过程中实时更新节点
     */
    shouldUpdateAttributesForBoundsChange(): boolean { return false }
}

/**
 * 把二分查找的规则抽出来封装一下，继承这个类的布局，默认通过二分查找实现查找业务  
 * 这种查找规则对数据量很大的有序列表来说相对高效，具体是否使用还是要根据实际排列需求决定  
 */
export abstract class YXBinaryLayout extends YXLayout {

    /**
     * @bug 如果节点大小差距很大，可能会导致计算屏幕内节点时不准确，出现节点不被正确添加到滚动视图上的问题
     * @fix 可以通过此属性，追加屏幕显示的节点数量
     * 设置这个值会在检查是否可见的节点时，尝试检查更多的可能处于屏幕外的节点，具体设置多少要根据实际情况调试，一般如果都是正常大小的节点，不需要考虑这个配置
     * 设置负值会检查所有的节点
     */
    extraVisibleCount: number = 0

    layoutAttributesForElementsInRect(rect: math.Rect, collectionView: YXCollectionView): YXLayoutAttributes[] {
        if (this.extraVisibleCount < 0) {
            return super.layoutAttributesForElementsInRect(rect, collectionView)
        }

        // 二分先查出大概位置
        let midIdx = -1
        let left = 0
        let right = this.attributes.length - 1

        while (left <= right && right >= 0) {
            let mid = left + (right - left) / 2
            mid = Math.floor(mid)
            let attr = this.attributes[mid]
            if (rect.intersects(attr.frame)) {
                midIdx = mid
                break
            }
            if (rect.yMax < attr.frame.yMin || rect.xMax < attr.frame.xMin) {
                right = mid - 1
            } else {
                left = mid + 1
            }
        }
        if (midIdx < 0) {
            return super.layoutAttributesForElementsInRect(rect, collectionView)
        }

        let result = []
        result.push(this.attributes[midIdx])

        // 往前检查
        let startIdx = midIdx
        while (startIdx > 0) {
            let idx = startIdx - 1
            let attr = this.attributes[idx]
            if (rect.intersects(attr.frame) == false) {
                break
            }
            result.push(attr)
            startIdx = idx
        }

        // 追加检查
        let extra_left = this.extraVisibleCount
        while (extra_left > 0) {
            let idx = startIdx - 1
            if (idx < 0) { break }
            let attr = this.attributes[idx]
            if (rect.intersects(attr.frame)) { result.push(attr) }
            startIdx = idx
            extra_left--
        }

        // 往后检查
        let endIdx = midIdx
        while (endIdx < this.attributes.length - 1) {
            let idx = endIdx + 1
            let attr = this.attributes[idx]
            if (rect.intersects(attr.frame) == false) {
                break
            }
            result.push(attr)
            endIdx = idx
        }

        // 追加检查
        let extra_right = this.extraVisibleCount
        while (extra_right > 0) {
            let idx = endIdx + 1
            if (idx >= this.attributes.length) { break }
            let attr = this.attributes[idx]
            if (rect.intersects(attr.frame)) { result.push(attr) }
            endIdx = idx
            extra_right--
        }

        return result
    }

    layoutAttributesForItemAtIndexPath(indexPath: YXIndexPath, collectionView: YXCollectionView): YXLayoutAttributes {
        let left = 0
        let right = this.attributes.length - 1

        while (left <= right && right >= 0) {
            let mid = left + (right - left) / 2
            mid = Math.floor(mid)
            let attr = this.attributes[mid]
            if (attr.indexPath.equals(indexPath)) {
                return attr
            }
            if (attr.indexPath.section < indexPath.section || (attr.indexPath.section == indexPath.section && attr.indexPath.item < indexPath.item)) {
                left = mid + 1
            } else {
                right = mid - 1
            }
        }
        return super.layoutAttributesForItemAtIndexPath(indexPath, collectionView)
    }
}

/**
 * @see NodePool.poolHandlerComp
 * 节点的自定义组件可以通过这个接口跟 NodePool 的重用业务关联起来
 */
export interface YXCollectionViewCell extends Component {
    unuse(): void;
    reuse(args: any): void;
}

/**
 * 列表组件
 */
@ccclass('YXCollectionView')
@disallowMultiple(true)
@executionOrder(-1)
@help(`https://gitee.com/568071718/creator-collection-view-doc`)
export class YXCollectionView extends Component {

    /**
     * 访问定义的私有枚举
     */
    static ScrollDirection = _yx_collection_view_scroll_direction
    static Mode = _yx_collection_view_list_mode

    /**
     * 滚动视图组件
     */
    get scrollView(): ScrollView {
        let result = this.node.getComponent(_scroll_view)
        if (result == null) {
            result = this.node.addComponent(_scroll_view)
            // 配置 scroll view 默认参数
        }
        if (result.content == null) {
            let content = new Node(`com.yx.scroll.content`)
            content.parent = result.node
            content.layer = content.parent.layer

            let transform = content.getComponent(UITransform) || content.addComponent(UITransform)
            transform.contentSize = this.node.getComponent(UITransform).contentSize

            result.content = content
        }

        if (this.mask) {
            let mask = result.node.getComponent(Mask)
            if (mask == null) {
                mask = result.node.addComponent(Mask)
                mask.type = Mask.Type.GRAPHICS_RECT
            }
        }

        return result
    }
    private get _scrollView(): _scroll_view { return this.scrollView as _scroll_view }

    /**
     * 自动给挂载节点添加 mask 组件  
     */
    @property({ tooltip: `自动给挂载节点添加 mask 组件`, visible: true })
    private mask: boolean = true

    /**
     * 允许手势滚动
     */
    @property({ tooltip: `允许手势滚动` })
    scrollEnabled: boolean = true

    /**
     * 允许鼠标滑轮滚动  
     */
    @property({ tooltip: `允许鼠标滑轮滚动` })
    wheelScrollEnabled: boolean = false

    /**
     * 列表滚动方向，默认垂直方向滚动  
     * 自定义 YXLayout 应该尽量根据这个配置来实现不同方向的布局业务  
     * 注意: 如果使用的 YXLayout 未支持对应的滚动方向，则此配置不会生效
     */
    @property({ type: _yx_collection_view_scroll_direction, tooltip: `列表滚动方向` })
    scrollDirection: YXCollectionView.ScrollDirection = YXCollectionView.ScrollDirection.VERTICAL

    /**
     * 列表单元节点加载模式
     */
    @property({ type: _yx_collection_view_list_mode, tooltip: `列表单元节点加载模式 (详细区别查看枚举注释)\nRECYCLE: 根据列表显示范围加载需要的节点，同类型的节点会进行复用\nPRELOAD: 会实例化所有节点，并非真正的虚拟列表，仅仅是把显示范围外的节点透明了，如果列表数据量很大仍然会卡` })
    mode: YXCollectionView.Mode = YXCollectionView.Mode.RECYCLE

    /**
     * 预加载模式下每帧加载多少个节点
     */
    @property({
        tooltip: `预加载模式下每帧加载多少个节点`,
        visible: function (this) {
            return (this.mode == _yx_collection_view_list_mode.PRELOAD)
        }
    })
    preloadNodesLimitPerFrame: number = 2

    /**
     * 预加载进度  
     */
    preloadProgress: (current: number, total: number) => void = null

    /**
     * 每多少帧刷新一次可见节点，1 表示每帧都刷
     */
    @property({ tooltip: `每多少帧刷新一次可见节点，1 表示每帧都刷` })
    frameInterval: number = 1

    /**
     * 滚动过程中，每多少帧回收一次不可见节点，1表示每帧都回收，0表示不在滚动过程中回收不可见节点
     * @bug 滚动过程中如果实时的回收不可见节点，有时候会收不到 scroll view 的 cancel 事件，导致 scroll view 的滚动状态不会更新 (且收不到滚动结束事件)
     * @fix 当这个属性设置为 0 时，只会在 `touch-up` 和 `scroll-ended` 里面回收不可见节点  
     */
    @property({ tooltip: `滚动过程中，每多少帧回收一次不可见节点，1表示每帧都回收，0表示不在滚动过程中回收不可见节点` })
    recycleInterval: number = 1

    /**
     * 通过编辑器注册节点类型
     */
    @property({ type: [_yx_editor_register_cell_info], visible: true, displayName: `Register Cells`, tooltip: `配置此列表内需要用到的 cell 节点类型` })
    private registerCellForEditor: _yx_editor_register_cell_info[] = []

    /**
     * 注册 cell
     * 可多次注册不同种类的 cell，只要确保 @identifier 的唯一性就好
     * @param identifier cell 标识符，通过 @dequeueReusableCell 获取重用 cell 时，会根据这个值匹配
     * @param maker 生成节点，当重用池里没有可用的节点时，会通过这个回调获取节点，需要在这个回调里面生成节点
     * @param poolComp (可选) 节点自定义组件，可以通过这个组件跟 @NodePool 的重用业务关联起来
     */
    register(identifier: string, maker: () => Node, poolComp: (new (...args: any[]) => YXCollectionViewCell) | string | null = null) {
        let pool = new NodePool(poolComp)
        this.pools.set(identifier, pool)
        this.makers.set(identifier, maker)
    }

    /**
     * 每个注册的标识符对应一个节点池
     */
    private pools: Map<string, NodePool> = new Map()

    /**
     * 每个注册的标识符对应一个生成节点回调
     */
    private makers: Map<string, () => Node> = new Map()

    /**
     * 通过标识符从重用池里取出一个可用的 cell 节点
     * @param identifier 注册时候的标识符  
     * @returns 
     */
    dequeueReusableCell(identifier: string): Node {
        let pool = this.pools.get(identifier)
        if (pool == null) {
            throw new Error(`YXCollectionView: 未注册标识符为 \`${identifier}\` 的 cell，请先调用 YXCollectionView 的 register() 方法注册 cell 节点`);
        }
        let result: Node = null

        // 尝试从重用池获取
        if (result == null) {
            result = pool.get()
        }

        // 重新生成一个  
        if (result == null) {
            const maker = this.makers.get(identifier)
            result = maker()
            let cell = result.getComponent(_cell_) || result.addComponent(_cell_)
            cell.identifier = identifier

            result.on(NodeEventType.TOUCH_END, this.onTouchItem, this)
        }
        return result
    }

    /**
     * 内容要分几个区展示，默认 1
     * 没有分区展示的需求可以不管这个配置
     */
    numberOfSections: number | ((collectionView: YXCollectionView) => number) = 1
    getNumberOfSections(): number {
        if (this.numberOfSections instanceof Function) { return this.numberOfSections(this) }
        return this.numberOfSections
    }

    /**
     * 每个区里要展示多少条内容
     */
    numberOfItems: number | ((section: number, collectionView: YXCollectionView) => number) = 0
    getNumberOfItems(section: number): number {
        if (this.numberOfItems instanceof Function) { return this.numberOfItems(section, this) }
        return this.numberOfItems
    }

    /**
     * 配置每块内容对应的 UI 节点  
     * 在这个方法里，需要确定 indexPath 这个位置对应的节点应该是用注册过的哪个类型的 Node 节点，然后通过 dequeueReusableCell 生成对应的 Node
     * 
     * @example
     * yourList.cellForItemAt = (indexPath ,collectionView) => {
     *      let cell = collectionView.dequeueReusableCell(`your identifier`)
     *      let comp = cell.getComponent(YourCellComp)
     *      comp.label.string = `${indexPath}`
     *      return cell
     * }
     * 
     * @returns 注意: 不要在这个方法里创建新的节点对象，这个方法返回的 Node，必须是通过 dequeueReusableCell 匹配到的 Node
     */
    cellForItemAt: (indexPath: YXIndexPath, collectionView: YXCollectionView) => Node = null

    /**
     * 当 cell 进入当前可见范围后执行    
     * 如果同类型的节点大小可能不一样，可以在这里调整子节点的位置   
     */
    onCellDisplay: (cell: Node, indexPath: YXIndexPath, collectionView: YXCollectionView) => void = null

    /**
     * 当 cell 移出当前可见范围后执行
     */
    onCellEndDisplay: (cell: Node, indexPath: YXIndexPath, collectionView: YXCollectionView) => void = null

    /**
     * 点击到节点后执行这个方法  
     */
    onTouchItemAt: (indexPath: YXIndexPath, collectionView: YXCollectionView) => void = null
    private onTouchItem(ev: EventTouch) {
        if (this.onTouchItemAt) {
            let cell = ev.target.getComponent(_cell_)
            this.onTouchItemAt(cell.attributes.indexPath, this)
        }
    }

    /**
     * 布局规则
     */
    layout: YXLayout = null

    /**
     * 记录当前正在显示的所有节点
     * 通过 Map 结构实现，减少查找复杂度，key = indexpath.string  value = 对应的节点  
     */
    private visibleNodesMap: Map<string, Node> = new Map()

    /**
     * 记录预加载的所有节点
     * 相当于是 preload 模式下的节点缓存池子  
     */
    private preloadNodesMap: Map<string, Node> = new Map()

    /**
     * 获取列表当前的可见范围
     */
    get visibleRect(): math.Rect {
        const visibleRect = _scroll_view_visible_rect
        visibleRect.origin = this.scrollView.getScrollOffset()
        visibleRect.x = - visibleRect.x
        visibleRect.size = this.scrollView.view.contentSize
        return visibleRect
    }

    /**
     * 获取当前正在显示的所有节点/组件
     */
    get visibleNodes(): Node[] {
        let result: Node[] = []
        this.visibleNodesMap.forEach((value) => {
            result.push(value)
        })
        return result
    }
    get visibleCells(): YXCollectionView.Cell[] {
        let result: YXCollectionView.Cell[] = []
        this.visibleNodesMap.forEach((value) => {
            result.push(value.getComponent(_cell_))
        })
        return result
    }

    /**
     * 获取当前正在显示的某个节点/组件
     * @param indexPath 
     */
    getVisibleNode(indexPath: YXIndexPath): Node | null {
        return this.visibleNodesMap.get(indexPath.toString())
    }
    getVisibleCell(indexPath: YXIndexPath): YXCollectionView.Cell | null {
        let node = this.getVisibleNode(indexPath)
        if (node == null) { return null }
        return node.getComponent(_cell_)
    }

    /**
     * 获取指定节点的私有 cell 组件  
     */
    getCellComp(node: Node): YXCollectionView.Cell | null {
        if (node == null) { return null }
        return node.getComponent(_cell_)
    }

    /**
     * 刷新列表数据
     */
    reloadData() {
        if (this.node.activeInHierarchy && this.node.parent) {
            this._reloadData()
        } else {
            this._late_reload_data = true
        }
    }
    private _late_reload_data: boolean = false
    private update_reloadDataIfNeeds(dt: number) {
        if (this._late_reload_data == false) { return }
        this._reloadData()
    }
    private _reloadData() {
        this._late_reload_data = false
        // 校验 layout 参数
        if (this.layout == null) {
            throw new Error("YXCollectionView: 参数错误，请正确配置 layout 以确定布局方案");
        }
        // 立即停止当前滚动，准备刷新
        this.scrollView.stopAutoScroll()

        // 池子先清一下，可能会累积很多暂时用不到的节点  
        this.pools.forEach((element) => {
            element.clear()
        })

        // 回收模式下，移除掉正在显示的节点并加到池子里 (不需要销毁)
        if (this.mode == _yx_collection_view_list_mode.RECYCLE) {
            this.visibleNodesMap.forEach((value, key) => {
                const cell = value.getComponent(_cell_)
                this.pools.get(cell.identifier).put(value)
                this.visibleNodesMap.delete(key) // 从可见节点里删除
                if (this.onCellEndDisplay) {
                    this.onCellEndDisplay(cell.node, cell.attributes.indexPath, this)
                }
            })
            this.visibleNodesMap.clear()
        }

        // 预加载模式下，需要清空当前显示的所有节点以及已经预加载过的所有节点 (全部销毁)
        if (this.mode == _yx_collection_view_list_mode.PRELOAD) {
            // 销毁当前所有正在显示的节点
            this.visibleNodesMap.forEach((value, key) => {
                if (value) {
                    value.removeFromParent()
                    value.destroy()
                }
            })
            this.visibleNodesMap.clear()

            // 销毁所有预加载的节点
            this.preloadNodesMap.forEach((value, key) => {
                if (value) {
                    value.removeFromParent()
                    value.destroy()
                }
            })
            this.preloadNodesMap.clear()

            // 从第一个开始预加载节点
            this.preloadIdx = 0
        }

        // 记录一下当前的偏移量，保证数据更新之后位置也不会太偏
        let offset = this.scrollView.getScrollOffset()
        offset.x = -offset.x

        // 重新计算一遍布局属性
        this.layout.prepare(this)

        // 更新 content size
        let contentTransform = this.scrollView.content.getComponent(UITransform) || this.scrollView.content.addComponent(UITransform)
        contentTransform.contentSize = this.layout.contentSize

        // 默认偏移量 或者 恢复偏移量
        if (this.reloadDataCounter <= 0) {
            this.layout.initOffset(this)
        } else {
            let maxOffset = this.scrollView.getMaxScrollOffset()
            math.Vec2.min(offset, offset, maxOffset)
            this.scrollView.scrollToOffset(offset)
        }

        // 更新可见 cell 节点
        this.markForUpdateVisibleData(true)
        this.reloadDataCounter++
    }

    /**
     * 记录 @reloadData 执行了多少次了，用来区分刷新列表的时候是否是首次刷新列表
     */
    private reloadDataCounter: number = 0

    /**
     * 根据当前的可见区域调整需要显示的节点
     */
    private reloadVisibleCells(rect: math.Rect = null) {
        // 获取当前可见区域
        if (rect == null) {
            rect = this.visibleRect
        }

        // 根据可见区域，找出对应的布局属性
        let layoutAttributes = this.layout.layoutAttributesForElementsInRect(rect, this)

        // 按 zIndex 排序
        let shouldUpdateAttributesZIndex = this.layout.shouldUpdateAttributesZIndex()
        if (shouldUpdateAttributesZIndex) {
            if (layoutAttributes == null || layoutAttributes == this.layout.attributes) {
                layoutAttributes = this.layout.attributes.slice()
            }
            layoutAttributes.sort((a, b) => a.zIndex - b.zIndex)
        }

        /*
        let poolsCounter = 0
        this.pools.forEach((a) => {
            poolsCounter = poolsCounter + a.size()
        })
        log(`需要显示的节点数量: ${layoutAttributes.length}  当前显示的节点数量: ${this.scrollView.content.children.length}  缓存池里的节点数量: ${poolsCounter}`)
        */

        // 添加需要显示的节点
        for (let index = 0; index < layoutAttributes.length; index++) {
            const element = layoutAttributes[index];

            let cellNode = null
            // 检查是否已经预加载过了
            if (cellNode == null) {
                cellNode = this.preloadNodesMap.get(element.indexPath.toString())
            }
            // 检查节点是否正在显示了
            if (cellNode == null) {
                cellNode = this.getVisibleNode(element.indexPath)
            }
            // 尝试通过注册标识符从节点池获取节点
            if (cellNode == null) {
                cellNode = this.cellForItemAt(element.indexPath, this)
            }
            // 无法正确获取节点，报错
            if (cellNode == null) {
                throw new Error("需要实现 cellForItemAt 方法并确保正确的返回了节点");
            }

            // 恢复节点状态
            const restoreStatus = this.restoreCellNodeIfNeeds(cellNode)

            // 更新节点变化
            if (restoreStatus == 1 || this.layout.shouldUpdateAttributesForBoundsChange()) {
                this.applyLayoutAttributes(cellNode, element)
            }

            // 调整节点层级
            if (shouldUpdateAttributesZIndex) {
                cellNode.setSiblingIndex(-1)
            }

            // 标记此节点正在显示
            this.visibleNodesMap.set(element.indexPath.toString(), cellNode)

            // 通知 onCellDisplay 
            if (restoreStatus == 1) {
                if (this.onCellDisplay) {
                    this.onCellDisplay(cellNode, element.indexPath, this)
                }
            }
        }

        layoutAttributes = []
    }

    /**
     * 节点被回收后需要重新使用时，根据当前回收模式恢复节点的状态，保证节点可见
     */
    private restoreCellNodeIfNeeds(node: Node) {
        // 是否触发了恢复行为，0表示节点已经可见了  1表示触发了恢复行为，节点从不可见变为了可见
        let restoreStatus = 0

        // 不管哪种模式，父节点检查都是必须的，只有正确的添加了才能确保正常可见  
        if (node.parent != this.scrollView.content) {
            node.parent = this.scrollView.content
            restoreStatus = 1
        }

        // 如果启用了预加载模式，给节点挂上 UIOpacity 组件，未启用则不管
        let opacityComp = node.getComponent(UIOpacity)
        if (this.mode == _yx_collection_view_list_mode.PRELOAD) {
            if (opacityComp == null) {
                opacityComp = node.addComponent(UIOpacity)
            }
        }
        if (opacityComp) {
            if (opacityComp.opacity !== 255) {
                opacityComp.opacity = 255
                restoreStatus = 1
            }
        }

        return restoreStatus
    }

    /**
     * 回收不可见节点
     */
    private recycleInvisibleNodes(visibleRect: math.Rect = null) {
        if (visibleRect == null) {
            visibleRect = this.visibleRect
        }

        const _realFrame = _recycleInvisibleNodes_realFrame
        const _contentSize = this.scrollView.content.getComponent(UITransform).contentSize

        this.visibleNodesMap.forEach((value, key) => {
            const cell = value.getComponent(_cell_)
            /**
             * @version 1.0.2
             * 检查节点是否可见应该是通过变换后的位置来检查
             * 通过 boundingBox 获取实际变换后的大小
             * 把实际的 position 转换为 origin
             */
            let boundingBox = value.getComponent(UITransform).getBoundingBox()
            _realFrame.size = boundingBox.size
            _realFrame.x = (_contentSize.width - _realFrame.width) * 0.5 + value.position.x
            _realFrame.y = (_contentSize.height - _realFrame.height) * 0.5 - value.position.y
            if (visibleRect.intersects(_realFrame) == false) {
                if (this.mode == _yx_collection_view_list_mode.PRELOAD) {
                    value.getComponent(UIOpacity).opacity = 0
                    this.preloadNodesMap.set(cell.attributes.indexPath.toString(), value)
                } else {
                    this.pools.get(cell.identifier).put(value)
                }
                this.visibleNodesMap.delete(key) // 从可见节点里删除
                if (this.onCellEndDisplay) {
                    this.onCellEndDisplay(cell.node, cell.attributes.indexPath, this)
                }
            }
        })
    }

    /**
     * 调整节点的位置/变换
     */
    private applyLayoutAttributes(node: Node, attributes: YXLayoutAttributes) {
        let cell = node.getComponent(_cell_)
        cell.attributes = attributes

        let transform = node.getComponent(UITransform) || node.addComponent(UITransform)
        transform.setContentSize(attributes.frame.size)

        _vec3Out.x = - (this.layout.contentSize.width - attributes.frame.width) * 0.5 + attributes.frame.x
        _vec3Out.y = + (this.layout.contentSize.height - attributes.frame.height) * 0.5 - attributes.frame.y
        _vec3Out.z = node.position.z
        if (attributes.offset) {
            math.Vec3.add(_vec3Out, _vec3Out, attributes.offset)
        }
        node.position = _vec3Out

        if (attributes.scale) {
            node.scale = attributes.scale
        }
        if (attributes.eulerAngles) {
            node.eulerAngles = attributes.eulerAngles
        }
        if (this.layout.shouldUpdateAttributesOpacity() && attributes.opacity) {
            let opacity = node.getComponent(UIOpacity) || node.addComponent(UIOpacity)
            opacity.opacity = attributes.opacity
        }
    }

    /**
     * 滚动到指定节点的位置
     * @returns 
     */
    scrollTo(indexPath: YXIndexPath, timeInSecond: number = 0, attenuated: boolean = true) {
        let toOffSet: math.Vec2 = this.layout.scrollTo(indexPath, this)
        if (toOffSet == null) {
            toOffSet = this.layout.layoutAttributesForItemAtIndexPath(indexPath, this)?.frame.origin
        }
        if (toOffSet) {
            this.scrollView.stopAutoScroll()
            this.scrollView.scrollToOffset(toOffSet, timeInSecond, attenuated)
            this.markForUpdateVisibleData()
        }
    }

    /**
     * 生命周期方法
     */
    protected onLoad(): void {
        for (let index = 0; index < this.registerCellForEditor.length; index++) {
            const element = this.registerCellForEditor[index];
            this.register(element.identifier, () => instantiate(element.prefab), element.comp)
        }
        this.node.on(ScrollView.EventType.SCROLL_BEGAN, this.onScrollBegan, this)
        this.node.on(ScrollView.EventType.SCROLLING, this.onScrolling, this)
        this.node.on(ScrollView.EventType.TOUCH_UP, this.onScrollTouchUp, this)
        this.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnded, this)
        this._scrollView._yx_startAttenuatingAutoScrollTargetOffset = (touchMoveVelocity, startOffset, originTargetOffset, originScrollTime) => {
            return this.layout.targetOffset(this, touchMoveVelocity, startOffset, originTargetOffset, originScrollTime)
        }
    }

    protected onDestroy(): void {
        this.node.off(ScrollView.EventType.SCROLL_BEGAN, this.onScrollBegan, this)
        this.node.off(ScrollView.EventType.SCROLLING, this.onScrolling, this)
        this.node.off(ScrollView.EventType.TOUCH_UP, this.onScrollTouchUp, this)
        this.node.off(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnded, this)
        this._scrollView._yx_startAttenuatingAutoScrollTargetOffset = null

        // 销毁当前所有正在显示的节点
        this.visibleNodesMap.forEach((value, key) => {
            if (value) {
                value.removeFromParent()
                value.destroy()
            }
        })
        this.visibleNodesMap.clear()
        this.visibleNodesMap = null

        // 销毁所有预加载的节点
        this.preloadNodesMap.forEach((value, key) => {
            if (value) {
                value.removeFromParent()
                value.destroy()
            }
        })
        this.preloadNodesMap.clear()
        this.preloadNodesMap = null

        // 清空池子
        this.pools.forEach((element) => {
            element.clear()
        })
        this.pools.clear()
        this.pools = null

        this.makers.clear()
        this.makers = null

        if (this.layout) {
            this.layout.attributes = []
        }
    }

    private _frameIdx = 0
    protected update(dt: number): void {
        this._frameIdx++
        this.update_reloadVisibleCellsIfNeeds(dt)
        this.update_recycleInvisibleNodesIfNeeds(dt)
        this.update_reloadDataIfNeeds(dt)
        this.update_preloadNodeIfNeeds(dt)
    }

    /**
     * 刷新当前可见节点
     * @param force true: 立即刷新  false: 下帧刷新
     */
    private _late_update_visible_data: boolean = false
    markForUpdateVisibleData(force: boolean = false) {
        if (force) {
            const visibleRect = this.visibleRect
            this.reloadVisibleCells(visibleRect)
            this.recycleInvisibleNodes(visibleRect)
            return
        }
        this._late_update_visible_data = true
        this._late_recycle_invisible_node = true
    }

    /**
     * 更新可见区域节点逻辑
     */
    private update_reloadVisibleCellsIfNeeds(dt: number) {
        if (this._late_update_visible_data) {
            this._late_update_visible_data = false
            this.reloadVisibleCells()
            return
        }
        if ((this.frameInterval <= 1) || (this._frameIdx % this.frameInterval == 0)) {
            this.reloadVisibleCells()
            return
        }
    }

    /**
     * 回收不可见节点逻辑
     */
    private _late_recycle_invisible_node = false
    private update_recycleInvisibleNodesIfNeeds(dt: number) {
        if (this._late_recycle_invisible_node) {
            this._late_recycle_invisible_node = false
            this.recycleInvisibleNodes()
            return
        }

        if ((this.recycleInterval >= 1) && (this._frameIdx % this.recycleInterval == 0)) {
            this.recycleInvisibleNodes()
            return
        }
    }

    /**
     * 预加载节点逻辑
     */
    private preloadIdx: number = null
    private update_preloadNodeIfNeeds(dt: number) {
        if (this.mode !== _yx_collection_view_list_mode.PRELOAD) {
            return
        }
        if (this.preloadIdx == null) {
            return
        }
        if (this.preloadIdx >= this.layout.attributes.length) {
            return
        }
        if (this.preloadNodesLimitPerFrame <= 0) {
            return
        }

        let index = 0
        let stop = false
        while (!stop && index < this.preloadNodesLimitPerFrame) {

            const attr = this.layout.attributes[this.preloadIdx]
            const key = attr.indexPath.toString()
            let node: Node = null
            // 检查节点是否正在显示
            if (node == null) {
                node = this.getVisibleNode(attr.indexPath)
            }
            // 检查节点是否加载过了
            if (node == null) {
                node = this.preloadNodesMap.get(key)
            }
            // 预加载节点
            if (node == null) {
                node = this.cellForItemAt(attr.indexPath, this)
                this.restoreCellNodeIfNeeds(node)
                this.applyLayoutAttributes(node, attr)
                this.visibleNodesMap.set(key, node)
                this._late_recycle_invisible_node = true
            }
            // 保存节点
            this.preloadNodesMap.set(key, node)
            // 更新预加载索引
            this.preloadIdx++
            index++

            if (this.preloadProgress) {
                this.preloadProgress(this.preloadIdx, this.layout.attributes.length)
            }

            stop = (this.preloadIdx >= this.layout.attributes.length)
        }
    }

    private onScrollBegan() {
    }

    private onScrolling() {
        if (this.layout.shouldUpdateAttributesForBoundsChange()) {
            this.reloadVisibleCells()
        }
    }

    private onScrollTouchUp() {
        this.recycleInvisibleNodes()
    }

    private onScrollEnded() {
        this.markForUpdateVisibleData()
        this.recycleInvisibleNodes()
        this.layout.onScrollEnded(this)
    }

    /**
     * - - - - - - - - - - - - - - - - - - - - - - - - - - 
     * - - - - - - - - - - deprecateds - - - - - - - - - -
     * - - - - - - - - - - - - - - - - - - - - - - - - - - 
     * 
     * 所有标记过期的方法都可能在某个版本删除，如果有用到的需要尽快通过替换方案进行修改
     * 
     */

    /**
     * 获取所有正在显示节点的索引
     * @deprecated 可以考虑通过 visibleCells 实现对应的业务
     */
    get visibleIndexPaths(): YXIndexPath[] {
        let result: YXIndexPath[] = []
        this.visibleNodesMap.forEach((value) => {
            let cell = value.getComponent(_cell_)
            result.push(cell.attributes.indexPath.clone())
        })
        return result
    }

    /**
     * 获取指定节点的索引  
     * @deprecated 使用 getCellComp 代替
     */
    getVisibleNodeIndexPath(node: Node): _yx_readonly_deep<YXIndexPath> {
        let comp = this.getCellComp(node)
        if (comp) {
            return comp.attributes.indexPath
        }
        return null
    }
}

export namespace YXCollectionView {
    /**
     * 重定义私有类型
     */
    export type ScrollDirection = _yx_collection_view_scroll_direction
    export type Mode = _yx_collection_view_list_mode
    export type Cell = _yx_readonly_deep<_cell_>
}

