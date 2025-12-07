import { _decorator, Component, Enum, Event, EventMouse, EventTouch, instantiate, Mask, math, Node, NodeEventType, NodePool, Prefab, ScrollView, UIOpacity, UITransform } from 'cc';
const { ccclass, property, executionOrder, disallowMultiple, help } = _decorator;

const _vec3Out = new math.Vec3()
const _scroll_view_visible_rect = new math.Rect()
const _recycleInvisibleNodes_realFrame = new math.Rect()

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
 * 定义通过编辑器注册节点时的数据结构
 */
@ccclass(`_yx_editor_register_element_info`)
class _yx_editor_register_element_info {
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
export class YXIndexPath {
    private _item: number = 0
    private _section: number = 0
    public static ZERO: Readonly<YXIndexPath> = new YXIndexPath(0, 0)
    /**
     * 区索引
     */
    get section(): number { return this._section }

    /**
     * 单元格在区内的位置
     */
    get item(): number { return this._item }
    /**
     * item 别名  
     */
    get row(): number { return this.item }
    constructor(section: number, item: number) { this._section = section; this._item = item; }
    clone(): YXIndexPath { return new YXIndexPath(this.section, this.item) }
    equals(other: YXIndexPath): boolean { return (this.section == other.section && this.item == other.item) }
    toString(): string { return `${this.section} - ${this.item}` }
}

/**
 * 表示边距的对象
 */
export class YXEdgeInsets {
    public static ZERO: Readonly<YXEdgeInsets> = new YXEdgeInsets(0, 0, 0, 0)
    top: number;
    left: number;
    bottom: number;
    right: number;
    constructor(top: number, left: number, bottom: number, right: number) { this.top = top; this.left = left; this.bottom = bottom; this.right = right; }
    clone(): YXEdgeInsets { return new YXEdgeInsets(this.top, this.left, this.bottom, this.right) }
    equals(other: YXEdgeInsets): boolean { return (this.top == other.top && this.left == other.left && this.bottom == other.bottom && this.right == other.right) }
    set(other: YXEdgeInsets): void { this.top = other.top; this.left = other.left; this.bottom = other.bottom; this.right = other.right; }
    toString(): string { return `[ ${this.top}, ${this.left}, ${this.bottom}, ${this.right} ]` }
}

/**
 * 私有组件
 * 节点添加到 YXCollectionView 上时，自动挂载此组件，用来记录一些实时参数
 */
class _yx_node_element_comp extends Component {
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
 * https://github.com/cocos/cocos-engine/blob/v3.8.8/cocos/ui/scroll-view.ts
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

    ignoreScrollEndedDuringAutoScroll = false
    protected _dispatchEvent(event: string): void {
        // 这里非常奇怪，在快速滑动的时候收到了 `SCROLL_ENDED` 但是 `isAutoScrolling` 还是 true，感觉不太符合常理，看源码似乎是设计如此，不清楚是何用意  
        if (this.ignoreScrollEndedDuringAutoScroll && event === ScrollView.EventType.SCROLL_ENDED as string && this.isAutoScrolling()) {
            return
        }
        super._dispatchEvent(event)
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

class _yx_node_pool extends NodePool {
    getAtIdx(indexPath: YXIndexPath, ...args: any[]): Node | null {
        const nodes: Node[] = this['_pool']
        for (let index = 0; index < nodes.length; index++) {
            const obj = nodes[index];
            let comp = obj.getComponent(_yx_node_element_comp)
            if (comp && comp.attributes.indexPath.equals(indexPath)) {
                nodes.splice(index, 1)
                // @ts-ignore
                const handler = this.poolHandlerComp ? obj.getComponent(this.poolHandlerComp) : null;
                if (handler && handler.reuse) { handler.reuse(arguments); }
                return obj
            }
        }
        return null
    }
}

/**
 * 节点的布局属性
 */
export class YXLayoutAttributes {

    /**
     * 创建一个 cell 布局属性实例  
     */
    static layoutAttributesForCell(indexPath: YXIndexPath): YXLayoutAttributes {
        let result = new YXLayoutAttributes()
        result._indexPath = indexPath
        result._elementCategory = 'Cell'
        return result
    }

    /**
     * 创建一个 supplementary 布局属性实例  
     * @param kinds 自定义类别标识，更多说明查看 supplementaryKinds    
     */
    static layoutAttributesForSupplementary(indexPath: YXIndexPath, kinds: string): YXLayoutAttributes {
        let result = new YXLayoutAttributes()
        result._indexPath = indexPath
        result._elementCategory = 'Supplementary'
        result._supplementaryKinds = kinds
        return result
    }

    /**
     * 构造方法，外部禁止直接访问，需要通过上面的静态方法创建对象  
     */
    protected constructor() { }

    /**
     * 节点索引
     */
    get indexPath(): YXIndexPath { return this._indexPath }
    private _indexPath: YXIndexPath = null

    /**
     * 节点种类
     */
    get elementCategory() { return this._elementCategory }
    private _elementCategory: 'Cell' | 'Supplementary' = 'Cell'

    /**
     * Supplementary 种类，本身无实际意义，具体作用由自定义布局规则决定  
     */
    get supplementaryKinds() { return this._supplementaryKinds }
    private _supplementaryKinds: string = ''

    /**
     * 节点在滚动视图中的位置和大小属性
     * origin 属性表示节点在父视图坐标系中的左上角的位置，size 属性表示节点的宽度和高度
     */
    get frame(): math.Rect { return this._frame }
    private _frame: math.Rect = new math.Rect()

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
     * 需要在 prepare 内初始化
     */
    contentSize: math.Size = math.Size.ZERO

    /**
     * @required
     * 所有元素的布局属性  
     * 需要在 prepare 内初始化  
     * @todo 这个不应该限制为数组结构，准确来说是不应该限制开发者必须使用数组来保存所有布局属性，目前为了实现预加载模式暂时是必须要求数组结构，后续有好的方案的话应该考虑优化  
     */
    attributes: YXLayoutAttributes[] = []

    /**
     * @required
     * 子类重写实现布局方案  
     * 注意: 必须初始化滚动区域大小并赋值给 contentSize 属性  
     * 注意: 必须初始化所有的元素布局属性，并保存到 attributes 数组  
     * 可选: 根据 collectionView 的 scrollDirection 支持不同的滚动方向
     */
    abstract prepare(collectionView: YXCollectionView): void

    /**
     * @optional
     * 列表在首次更新数据后会执行这个方法  
     * 在这个方法里设置滚动视图的初始偏移量  
     * 
     * @example  
     * // 比如一个垂直列表希望初始化时从最顶部开始展示数据，那么可以在这个方法里通过 scrollToTop 实现  
     * initOffset(collectionView: YXCollectionView): void {
     *      collectionView.scrollView.scrollToTop()
     * }
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
     */
    onScrollEnded(collectionView: YXCollectionView) { }

    /**
     * @optional  
     * 当滚动视图的可见范围变化后执行，这个方法会在列表滚动过程中频繁的执行  
     * 在这个方法里可以调整节点属性以实现交互性的节点变换效果，(如果在这个方法里调整了节点变换属性，需要重写 shouldUpdateAttributesForBoundsChange 以支持实时变换)  
     * 
     * @param rect 当前滚动视图的可见区域  
     * 
     * @returns
     * 关于这个方法的返回值，最优的情况应该是根据实际的布局情况计算出当前显示区域内需要显示的所有布局属性  
     * 列表在更新可见节点时会遍历这个方法返回的数组并依次检查节点是否需要添加到列表内，默认这个方法是直接返回所有的布局属性，也就是在更新可见节点时的时间复杂度默认为 O(attributes.length)，除非有更优的算法，否则建议直接返回所有的布局属性  
     */
    layoutAttributesForElementsInRect(rect: math.Rect, collectionView: YXCollectionView): YXLayoutAttributes[] {
        return this.attributes
    }
    layoutAttributesForItemAtIndexPath(indexPath: YXIndexPath, collectionView: YXCollectionView): YXLayoutAttributes {
        return this.attributes.find((a) => a.indexPath.equals(indexPath) && a.elementCategory === 'Cell')
    }
    layoutAttributesForSupplementaryAtIndexPath(indexPath: YXIndexPath, collectionView: YXCollectionView, kinds: string): YXLayoutAttributes {
        return this.attributes.find((a) => a.indexPath.equals(indexPath) && a.elementCategory === 'Supplementary' && a.supplementaryKinds === kinds)
    }

    /**
     * @optional
     * 列表组件在调用 scrollTo 方法时会触发这个方法，如果实现了这个方法，最终的滚动停止位置以这个方法返回的为准  
     */
    scrollTo(indexPath: YXIndexPath, collectionView: YXCollectionView): math.Vec2 { return null }

    /**
     * @optional
     * @see YXLayoutAttributes.zIndex  
     */
    shouldUpdateAttributesZIndex(): boolean { return false }

    /**
     * @optional
     * @see YXLayoutAttributes.opacity  
     */
    shouldUpdateAttributesOpacity(): boolean { return false }

    /**
     * @optional
     * 此布局下的节点，是否需要实时更新变换效果
     * @returns 返回 true 会忽略 YXCollectionView 的 frameInterval 设置，强制在滚动过程中实时更新节点
     */
    shouldUpdateAttributesForBoundsChange(): boolean { return false }

    /**
     * @optional  
     * 列表组件销毁时执行  
     */
    onDestroy() { }
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
@help(`https://github.com/568071718/creator-collection-view`)
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
     * 备注: 如果使用的 YXLayout 未支持对应的滚动方向，则此配置不会生效，严格来说这个滚动方向本就应该是由 YXLayout 决定的，定义在这里是为了编辑器配置方便  
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
     * bug?? 还是特性?? 当列表快速滑动的时候会收到 `scroll-ended` 事件，但实际上快速滑动阶段只是手指频繁的松开按下，不应该定性为滚动结束  
     * 将这个属性设置为 `true` 后不会在快速滑动时发送 `scroll-ended` 事件  
     * 该属性为实验性的功能，暂时不清楚是否有其他隐患，如果碰到快速滑动行为引发一些奇怪问题时可以尝试修改此属性  
     */
    set ignoreScrollEndedDuringAutoScroll(value: boolean) {
        this._scrollView.ignoreScrollEndedDuringAutoScroll = value
    }
    get ignoreScrollEndedDuringAutoScroll(): boolean {
        return this._scrollView.ignoreScrollEndedDuringAutoScroll
    }

    /**
     * 列表内的元素位置是在 `reloadData` 那一刻决定的，所以当列表有 Widget 组件或者其他一些情况导致列表节点自身大小改变了但子元素的位置未更新   
     * 打开这个属性会在列表节点自身大小变化时自动重新计算一遍布局信息  
     */
    @property({ tooltip: `如果列表有 Widget 组件或者希望列表大小改变时自动刷新列表，可以打开此开关` })
    autoReloadOnSizeChange: boolean = false

    /**
     * 通过编辑器注册节点类型
     */
    @property({ type: [_yx_editor_register_element_info], visible: true, displayName: `Register Cells`, tooltip: `配置此列表内需要用到的 cell 节点类型` })
    private registerCellForEditor: _yx_editor_register_element_info[] = []
    @property({ type: [_yx_editor_register_element_info], visible: true, displayName: `Register Supplementarys`, tooltip: `配置此列表内需要用到的 Supplementary 节点类型` })
    private registerSupplementaryForEditor: _yx_editor_register_element_info[] = []

    /**
     * 注册 cell
     * 可多次注册不同种类的 cell，只要确保 identifier 的唯一性就好
     * @param identifier cell 标识符，通过 dequeueReusableCell 获取重用 cell 时，会根据这个值匹配
     * @param maker 生成节点，当重用池里没有可用的节点时，会通过这个回调获取节点，需要在这个回调里面生成节点
     * @param poolComp (可选) 节点自定义组件，可以通过这个组件跟 NodePool 的重用业务关联起来
     */
    registerCell(identifier: string, maker: () => Node, poolComp: (new (...args: any[]) => YXCollectionViewCell) | string | null = null) {
        let elementCategory: typeof YXLayoutAttributes.prototype.elementCategory = 'Cell'
        identifier = elementCategory + identifier
        let pool = new _yx_node_pool(poolComp)
        this.pools.set(identifier, pool)
        this.makers.set(identifier, maker)
    }

    /**
     * 注册 supplementary 追加视图，用法跟 registerCell 一样  
     */
    registerSupplementary(identifier: string, maker: () => Node, poolComp: (new (...args: any[]) => YXCollectionViewCell) | string | null = null) {
        let elementCategory: typeof YXLayoutAttributes.prototype.elementCategory = 'Supplementary'
        identifier = elementCategory + identifier
        let pool = new _yx_node_pool(poolComp)
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
     * @param indexPath 可选，尝试通过 indexPath 获取刷新之前的节点 (尽可能的保证刷新前和刷新后这个位置仍然是同一个节点)，避免节点复用导致的刷新闪烁问题  
     */
    dequeueReusableCell(identifier: string, indexPath: YXIndexPath = null): Node {
        return this._dequeueReusableElement(identifier, 'Cell', indexPath)
    }

    /**
     * 通过标识符从重用池里取出一个可用的 supplementary 节点
     * @param identifier 注册时候的标识符  
     * @param indexPath 可选，尝试通过 indexPath 获取刷新之前的节点 (尽可能的保证刷新前和刷新后这个位置仍然是同一个节点)，避免节点复用导致的刷新闪烁问题  
     */
    dequeueReusableSupplementary(identifier: string, indexPath: YXIndexPath = null): Node {
        return this._dequeueReusableElement(identifier, 'Supplementary', indexPath)
    }
    private _dequeueReusableElement(identifier: string, elementCategory: typeof YXLayoutAttributes.prototype.elementCategory, indexPath: YXIndexPath = null) {
        identifier = elementCategory + identifier
        let pool = this.pools.get(identifier)
        if (pool == null) {
            throw new Error(`YXCollectionView: dequeueReusable${elementCategory} 错误，未注册的 identifier`);
        }
        let result: Node = null

        // 尝试从重用池获取 (牺牲一点性能，尝试通过 indexPath 获取对应的节点，防止刷新闪烁的问题)
        if (result == null && indexPath && pool instanceof _yx_node_pool) {
            result = pool.getAtIdx(indexPath)
        }

        // 尝试从重用池获取
        if (result == null) {
            result = pool.get()
        }

        // 重新生成一个  
        if (result == null) {
            const maker = this.makers.get(identifier)
            result = maker()
            let cell = result.getComponent(_yx_node_element_comp) || result.addComponent(_yx_node_element_comp)
            cell.identifier = identifier

            result.on(NodeEventType.TOUCH_END, this.onTouchElement, this)
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
     * 用法跟 cellForItemAt 差不多，此方法内需要通过 dequeueReusableSupplementary 获取 Node 节点  
     * @param kinds 关于这个字段的具体含义应该根据使用的自定义 layout 决定  
     */
    supplementaryForItemAt: (indexPath: YXIndexPath, collectionView: YXCollectionView, kinds: string) => Node = null

    /**
     * cell 节点可见状态回调  
     * 如果同类型的节点大小可能不一样，可以在这里调整子节点的位置   
     */
    onCellDisplay: (node: Node, indexPath: YXIndexPath, collectionView: YXCollectionView) => void = null
    onCellEndDisplay: (node: Node, indexPath: YXIndexPath, collectionView: YXCollectionView) => void = null

    /**
     * supplementary 节点可见状态回调  
     */
    onSupplementaryDisplay: (node: Node, indexPath: YXIndexPath, collectionView: YXCollectionView, kinds: string) => void = null
    onSupplementaryEndDisplay: (node: Node, indexPath: YXIndexPath, collectionView: YXCollectionView, kinds: string) => void = null

    /**
     * 点击到 cell 节点后执行  
     */
    onTouchCellAt: (indexPath: YXIndexPath, collectionView: YXCollectionView) => void = null

    /**
     * 点击到 supplementary 节点后执行
     */
    onTouchSupplementaryAt: (indexPath: YXIndexPath, collectionView: YXCollectionView, kinds: string) => void = null

    /**
     * 节点点击事件  
     */
    private onTouchElement(ev: EventTouch) {
        const node = ev.target
        if (node instanceof Node == false) { return }
        const cell = node.getComponent(_yx_node_element_comp)
        if (cell == null) { return }
        const attr = cell.attributes
        if (attr == null) { return }
        if (attr.elementCategory === 'Cell') {
            if (this.onTouchCellAt) {
                this.onTouchCellAt(attr.indexPath, this)
                return
            }
            return
        }
        if (attr.elementCategory === 'Supplementary') {
            if (this.onTouchSupplementaryAt) {
                this.onTouchSupplementaryAt(attr.indexPath, this, attr.supplementaryKinds)
            }
            return
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
     * 获取节点缓存 key  
     */
    private _getLayoutAttributesCacheKey(element: YXLayoutAttributes): string {
        return this._getVisibleCacheKey(element.indexPath, element.elementCategory, element.supplementaryKinds)
    }
    private _getVisibleCacheKey(indexPath: YXIndexPath, elementCategory: typeof YXLayoutAttributes.prototype.elementCategory, kinds: string = '') {
        return `${indexPath}${elementCategory}${kinds}`
    }

    /**
     * 获取列表当前的可见范围  
     */
    getVisibleRect(): math.Rect {
        const visibleRect = _scroll_view_visible_rect
        visibleRect.origin = this.scrollView.getScrollOffset()
        visibleRect.x = - visibleRect.x
        visibleRect.size = this.scrollView.view.contentSize
        return visibleRect
    }

    /**
     * 通过索引获取指定的可见的 cell 节点  
     */
    getVisibleCellNode(indexPath: YXIndexPath): Node {
        const cacheKey = this._getVisibleCacheKey(indexPath, 'Cell')
        return this.visibleNodesMap.get(cacheKey)
    }

    /**
     * 通过索引获取指定的可见的 supplementary 节点  
     */
    getVisibleSupplementaryNode(indexPath: YXIndexPath, kinds: string): Node {
        const cacheKey = this._getVisibleCacheKey(indexPath, 'Supplementary', kinds)
        return this.visibleNodesMap.get(cacheKey)
    }

    /**
     * 获取所有正在显示的 cell 节点  
     */
    getVisibleCellNodes(): Node[] {
        let result: Node[] = []
        this.visibleNodesMap.forEach((value) => {
            const comp = value.getComponent(_yx_node_element_comp)
            if (comp.attributes.elementCategory === 'Cell') {
                result.push(value)
            }
        })
        return result
    }

    /**
     * 获取所有正在显示的 supplementary 节点  
     * @param kinds 可选按种类筛选  
     */
    getVisibleSupplementaryNodes(kinds: string = null): Node[] {
        let result: Node[] = []
        this.visibleNodesMap.forEach((value) => {
            const comp = value.getComponent(_yx_node_element_comp)
            if (comp.attributes.elementCategory === 'Supplementary') {
                if (kinds === null || comp.attributes.supplementaryKinds === kinds) {
                    result.push(value)
                }
            }
        })
        return result
    }

    /**
     * 获取指定节点绑定的布局属性对象  
     */
    getElementAttributes(node: Node): YXLayoutAttributes {
        const comp = node.getComponent(_yx_node_element_comp)
        return comp ? comp.attributes : null
    }

    /**
     * 刷新列表数据
     */
    reloadData() {
        if (this.node != null && this.node.activeInHierarchy && this.node.parent && this.layout != null) {
            this._reloadData()
            return
        }
        this._late_reload_data = true
    }
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
        this.pools.forEach((element) => { element.clear() })

        // 回收模式下，移除掉正在显示的节点并加到池子里 (不需要销毁)
        if (this.mode == _yx_collection_view_list_mode.RECYCLE) {
            this.visibleNodesMap.forEach((value, key) => {
                const cell = value.getComponent(_yx_node_element_comp)
                this.pools.get(cell.identifier).put(value)
                this.visibleNodesMap.delete(key) // 从可见节点里删除
                if (cell.attributes.elementCategory === 'Cell') {
                    if (this.onCellEndDisplay) {
                        this.onCellEndDisplay(cell.node, cell.attributes.indexPath, this)
                    }
                }
                if (cell.attributes.elementCategory === 'Supplementary') {
                    if (this.onSupplementaryEndDisplay) {
                        this.onSupplementaryEndDisplay(cell.node, cell.attributes.indexPath, this, cell.attributes.supplementaryKinds)
                    }
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
    private reloadVisibleElements(visibleRect: math.Rect = null) {
        this._late_update_visible_data = false
        if (visibleRect == null) { visibleRect = this.getVisibleRect() }

        // 根据可见区域，找出对应的布局属性
        let layoutAttributes = this.layout.layoutAttributesForElementsInRect(visibleRect, this)

        // 按 zIndex 排序
        let shouldUpdateAttributesZIndex = this.layout.shouldUpdateAttributesZIndex()
        if (shouldUpdateAttributesZIndex) {
            if (layoutAttributes == null || layoutAttributes == this.layout.attributes) {
                layoutAttributes = this.layout.attributes.slice()
            }
            layoutAttributes.sort((a, b) => a.zIndex - b.zIndex)
        }

        let shouldUpdateAttributesForBoundsChange = this.layout.shouldUpdateAttributesForBoundsChange()

        // 添加需要显示的节点
        for (let index = 0; index < layoutAttributes.length; index++) {
            const element = layoutAttributes[index];
            if (visibleRect.intersects(element.frame) == false) { continue }
            const cacheKey = this._getLayoutAttributesCacheKey(element)
            let elementNode = null
            // 检查是否已经预加载过了
            if (elementNode == null) {
                elementNode = this.preloadNodesMap.get(cacheKey)
            }
            // 检查节点是否正在显示了
            if (elementNode == null) {
                elementNode = this.visibleNodesMap.get(cacheKey)
            }
            // 尝试通过注册标识符从节点池获取节点
            if (elementNode == null) {
                if (element.elementCategory === 'Cell') {
                    elementNode = this.cellForItemAt(element.indexPath, this)
                }
                if (element.elementCategory === 'Supplementary') {
                    elementNode = this.supplementaryForItemAt(element.indexPath, this, element.supplementaryKinds)
                }
            }
            // 无法正确获取节点，报错
            if (elementNode == null) {
                if (element.elementCategory === 'Cell') {
                    throw new Error("需要实现 cellForItemAt 方法并确保正确的返回了节点");
                }
                if (element.elementCategory === 'Supplementary') {
                    throw new Error("需要实现 supplementaryForItemAt 方法并确保正确的返回了节点");
                }
            }

            // 恢复节点状态
            const restoreStatus = this.restoreNodeIfNeeds(elementNode)

            // 更新节点变化
            if (restoreStatus == 1 || shouldUpdateAttributesForBoundsChange) {
                this.applyLayoutAttributes(elementNode, element)
            }

            // 调整节点层级
            if (shouldUpdateAttributesZIndex) {
                elementNode.setSiblingIndex(-1)
            }

            // 标记此节点正在显示
            this.visibleNodesMap.set(cacheKey, elementNode)

            // 通知 display 
            if (restoreStatus == 1) {
                if (element.elementCategory === 'Cell') {
                    if (this.onCellDisplay) {
                        this.onCellDisplay(elementNode, element.indexPath, this)
                    }
                }
                if (element.elementCategory === 'Supplementary') {
                    if (this.onSupplementaryDisplay) {
                        this.onSupplementaryDisplay(elementNode, element.indexPath, this, element.supplementaryKinds)
                    }
                }
            }
        }

        layoutAttributes = []
    }

    /**
     * 节点被回收后需要重新使用时，根据当前回收模式恢复节点的状态，保证节点可见
     */
    private restoreNodeIfNeeds(node: Node) {
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
        this._late_recycle_invisible_node = false
        if (visibleRect == null) { visibleRect = this.getVisibleRect() }

        const _realFrame = _recycleInvisibleNodes_realFrame
        const _contentSize = this.scrollView.content.getComponent(UITransform).contentSize

        this.visibleNodesMap.forEach((value, key) => {
            const cell = value.getComponent(_yx_node_element_comp)
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
                    this.preloadNodesMap.set(key, value)
                } else {
                    this.pools.get(cell.identifier).put(value)
                }
                this.visibleNodesMap.delete(key) // 从可见节点里删除
                if (cell.attributes.elementCategory === 'Cell') {
                    if (this.onCellEndDisplay) {
                        this.onCellEndDisplay(cell.node, cell.attributes.indexPath, this)
                    }
                }
                if (cell.attributes.elementCategory === 'Supplementary') {
                    if (this.onSupplementaryEndDisplay) {
                        this.onSupplementaryEndDisplay(cell.node, cell.attributes.indexPath, this, cell.attributes.supplementaryKinds)
                    }
                }
            }
        })
    }

    /**
     * 调整节点的位置/变换
     */
    private applyLayoutAttributes(node: Node, attributes: YXLayoutAttributes) {
        let cell = node.getComponent(_yx_node_element_comp)
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
     * 刷新当前可见节点
     * @param force true: 立即刷新;  false: 根据设置的刷新帧间隔在合适的时候刷新  
     */
    markForUpdateVisibleData(force: boolean = false) {
        if (force) {
            const visibleRect = this.getVisibleRect()
            this.reloadVisibleElements(visibleRect)
            this.recycleInvisibleNodes(visibleRect)
            return
        }
        this._late_update_visible_data = true
        this._late_recycle_invisible_node = true
    }

    /**
     * 滚动到指定节点的位置  
     * @todo 支持偏移方位，目前固定是按顶部的位置的，有特殊需求的建议直接通过 .scrollView.scrollToOffset() 实现   
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
            this.registerCell(element.identifier, () => instantiate(element.prefab), element.comp)
        }
        for (let index = 0; index < this.registerSupplementaryForEditor.length; index++) {
            const element = this.registerSupplementaryForEditor[index];
            this.registerSupplementary(element.identifier, () => instantiate(element.prefab), element.comp)
        }
        this.node.on(ScrollView.EventType.SCROLL_BEGAN, this.onScrollBegan, this)
        this.node.on(ScrollView.EventType.SCROLLING, this.onScrolling, this)
        this.node.on(ScrollView.EventType.TOUCH_UP, this.onScrollTouchUp, this)
        this.node.on(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnded, this)
        this.node.on(NodeEventType.SIZE_CHANGED, this.onSizeChange, this)
        this._scrollView._yx_startAttenuatingAutoScrollTargetOffset = (touchMoveVelocity, startOffset, originTargetOffset, originScrollTime) => {
            return this.layout.targetOffset(this, touchMoveVelocity, startOffset, originTargetOffset, originScrollTime)
        }
    }

    protected onDestroy(): void {
        this.node.off(ScrollView.EventType.SCROLL_BEGAN, this.onScrollBegan, this)
        this.node.off(ScrollView.EventType.SCROLLING, this.onScrolling, this)
        this.node.off(ScrollView.EventType.TOUCH_UP, this.onScrollTouchUp, this)
        this.node.off(ScrollView.EventType.SCROLL_ENDED, this.onScrollEnded, this)
        this.node.off(NodeEventType.SIZE_CHANGED, this.onSizeChange, this)
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
            this.layout.onDestroy()
        }
    }

    private _frameIdx = 0 // 帧计数
    private _late_update_visible_data: boolean = false // 当前帧是否需要更新可见节点  
    private _late_recycle_invisible_node = false // 当前帧是否需要回收不可见节点  
    private _late_reload_data: boolean = false // 当前帧是否需要更新列表数据  
    protected update(dt: number): void {
        this._frameIdx++
        this.update_reloadVisibleNodesIfNeeds(dt)
        this.update_recycleInvisibleNodesIfNeeds(dt)
        this.update_reloadDataIfNeeds(dt)
        this.update_preloadNodeIfNeeds(dt)
    }

    /**
     * 更新可见区域节点逻辑
     */
    private update_reloadVisibleNodesIfNeeds(dt: number) {
        if (this._late_update_visible_data == false) { return }
        if ((this.frameInterval <= 1) || (this._frameIdx % this.frameInterval == 0)) {
            this.reloadVisibleElements()
            return
        }
    }

    /**
     * 回收不可见节点逻辑
     */
    private update_recycleInvisibleNodesIfNeeds(dt: number) {
        if (this._late_recycle_invisible_node == false) { return }
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
        if (this.mode !== _yx_collection_view_list_mode.PRELOAD) { return }
        if (this.preloadIdx == null) { return }
        if (this.preloadIdx >= this.layout.attributes.length) { return }
        if (this.preloadNodesLimitPerFrame <= 0) { return }

        let index = 0
        let stop = false
        while (!stop && index < this.preloadNodesLimitPerFrame) {

            const attr = this.layout.attributes[this.preloadIdx]
            const cacheKey = this._getLayoutAttributesCacheKey(attr)
            let node: Node = null
            // 检查节点是否正在显示
            if (node == null) {
                node = this.visibleNodesMap.get(cacheKey)
            }
            // 检查节点是否加载过了
            if (node == null) {
                node = this.preloadNodesMap.get(cacheKey)
            }
            // 预加载节点
            if (node == null) {
                if (attr.elementCategory === 'Cell') {
                    node = this.cellForItemAt(attr.indexPath, this)
                }
                if (attr.elementCategory === 'Supplementary') {
                    node = this.supplementaryForItemAt(attr.indexPath, this, attr.supplementaryKinds)
                }
                this.restoreNodeIfNeeds(node)
                this.applyLayoutAttributes(node, attr)
                this.visibleNodesMap.set(cacheKey, node)
                this._late_recycle_invisible_node = true
            }
            // 保存节点
            this.preloadNodesMap.set(cacheKey, node)
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
        // 在滚动过程中仅仅是标记更新状态，具体更新业务统一到 update 里面处理，但是 layout 设置了实时更新的情况时例外  
        if (this.layout.shouldUpdateAttributesForBoundsChange()) {
            this.reloadVisibleElements()
        } else {
            this._late_update_visible_data = true
        }
        if (this.recycleInterval > 0) {
            this._late_recycle_invisible_node = true
        }
    }

    private onScrollTouchUp() {
        this.recycleInvisibleNodes()
    }

    private onScrollEnded() {
        this.recycleInvisibleNodes()
        this.layout.onScrollEnded(this)
    }

    private onSizeChange() {
        if (this.autoReloadOnSizeChange) {
            this.reloadData()
        }
    }
}

export namespace YXCollectionView {
    /**
     * 重定义私有类型
     */
    export type ScrollDirection = _yx_collection_view_scroll_direction
    export type Mode = _yx_collection_view_list_mode
}

/**
 * *****************************************************************************************  
 * *****************************************************************************************   
 * 把二分查找的规则抽出来封装一下，继承这个类的布局，默认通过二分查找实现查找业务  
 * 这种查找规则对数据量很大的有序列表来说相对高效，具体是否使用还是要根据实际排列需求决定  
 * *****************************************************************************************  
 * *****************************************************************************************  
 * 
 * @deprecated 1.4.0 版本开始，在自定义布局规则的时候暂时不建议继承这个规则了，如何优化查找算法应该全靠开发者根据实际需求自行实现，目前保留这个是为了 flow-layout 使用，后续有更优方案的话可能会删除这部分代码    
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
        if (this.attributes.length <= 100) { return this.attributes } // 少量数据就不查了，直接返回全部  
        if (this.extraVisibleCount < 0) { return this.attributes }

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
}