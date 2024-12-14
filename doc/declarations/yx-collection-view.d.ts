import { Component, math, Node, ScrollView, ValueType } from 'cc';
type _yx_readonly_deep<T> = {
    readonly [P in keyof T]: T[P] extends Record<string, any> ? _yx_readonly_deep<T[P]> : T[P];
};
/**
 * 定义列表的滚动方向
 */
declare enum _yx_collection_view_scroll_direction {
    /**
     * 水平滚动
     */
    HORIZONTAL = 0,
    /**
     * 垂直滚动
     */
    VERTICAL = 1
}
/**
 * 列表节点加载模式
 */
declare enum _yx_collection_view_list_mode {
    /**
     * 根据列表显示范围加载需要的节点，同类型的节点会进行复用
     * 优点: 控制总节点数量，不会创建大量节点
     * 缺点: 因为有复用逻辑，节点内容会频繁更新，cell 更新业务比较重的话列表会抖动，例如 Label (NONE) 很多的节点
     */
    RECYCLE = 0,
    /**
     * 直接预加载所有的节点，处于列表显示范围外的节点透明化处理
     * 优点: 避免 cell 频繁更新，优化大量 Label (NONE) 场景下的卡顿问题
     * 缺点: 会实例化所有节点，并非真正的虚拟列表，仅仅是把显示范围外的节点透明了，如果列表数据量很大仍然会卡
     */
    PRELOAD = 1
}
/**
 * 表示索引的对象
 */
export declare class YXIndexPath extends ValueType {
    static ZERO: Readonly<YXIndexPath>;
    /**
     * 区索引
     */
    section: number;
    /**
     * 单元格在区内的位置
     */
    item: number;
    set row(value: number);
    get row(): number;
    constructor(section: number, item: number);
    clone(): YXIndexPath;
    equals(other: YXIndexPath): boolean;
    set(other: YXIndexPath): void;
    toString(): string;
}
/**
 * 表示边距的对象
 */
export declare class YXEdgeInsets extends ValueType {
    static ZERO: Readonly<YXEdgeInsets>;
    top: number;
    left: number;
    bottom: number;
    right: number;
    constructor(top: number, left: number, bottom: number, right: number);
    clone(): YXEdgeInsets;
    equals(other: YXEdgeInsets): boolean;
    set(other: YXEdgeInsets): void;
    toString(): string;
}
/**
 * 私有组件
 * cell 节点添加到 YXCollectionView 上时，自动挂载此组件，用来记录一些实时参数
 */
declare class _cell_ extends Component {
    /**
     * 此节点是通过哪个标识符创建的
     */
    identifier: string;
    /**
     * 此节点目前绑定的布局属性
     */
    attributes: YXLayoutAttributes;
}
/**
 * 节点的布局属性
 */
export declare class YXLayoutAttributes {
    /**
     * 节点索引
     */
    get indexPath(): YXIndexPath;
    constructor(indexPath: YXIndexPath);
    /**
     * 节点在滚动视图中的位置和大小属性
     * origin 属性表示节点在父视图坐标系中的左上角的位置，size 属性表示节点的宽度和高度
     */
    frame: math.Rect;
    /**
     * 节点层级
     * 越小会越早的添加到滚动视图上
     * https://docs.cocos.com/creator/manual/zh/ui-system/components/editor/ui-transform.html?h=uitrans
     * 备注: 内部暂时是通过节点的 siblingIndex 实现的，如果自定义 layout 有修改这个值的需求，需要重写 layout 的 @shouldUpdateAttributesZIndex 方法，默认情况下会忽略这个配置
     */
    zIndex: number;
    /**
     * 节点透明度
     * 备注: 内部通过 UIOpacity 组件实现，会修改节点 UIOpacity 组件的 opacity 值，如果自定义 layout 有修改这个值的需求，需要重写 layout 的 @shouldUpdateAttributesOpacity 方法，默认情况下会忽略这个配置
     */
    opacity: number;
    /**
     * 节点变换 - 缩放
     */
    scale: math.Vec3;
    /**
     * 节点变换 - 平移
     */
    offset: math.Vec3;
    /**
     * 节点变换 - 旋转
     * 备注: 3D 变换似乎需要透视相机???
     */
    eulerAngles: math.Vec3;
}
/**
 * 布局规则
 * 这里只是约定出了一套接口，内部只是一些基础实现，具体布局方案通过子类重载去实现
 */
export declare abstract class YXLayout {
    constructor();
    /**
     * @required
     * 整个滚动区域大小
     * 需要在 @prepare 内初始化
     */
    contentSize: math.Size;
    /**
     * @required
     * 所有元素的布局属性
     * 需要在 @prepare 内初始化
     */
    attributes: YXLayoutAttributes[];
    /**
     * @required
     * 子类重写实现布局方案
     * 注意: 必须初始化滚动区域大小并赋值给 @contentSize 属性
     * 注意: 必须初始化所有的元素布局属性，并保存到 @attributes 数组
     * 可选: 根据 collectionView 的 scrollDirection 支持不同的滚动方向
     */
    abstract prepare(collectionView: YXCollectionView): void;
    /**
     * @optional
     * 列表在首次更新数据后会执行这个方法
     * 在这个方法里设置滚动视图的初始偏移量
     */
    initOffset(collectionView: YXCollectionView): void;
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
    targetOffset(collectionView: YXCollectionView, touchMoveVelocity: math.Vec3, startOffset: math.Vec2, originTargetOffset: math.Vec2, originScrollDuration: number): {
        offset: math.Vec2;
        time?: number;
        attenuated?: boolean;
    } | null;
    /**
     * @optional
     * 列表每次滚动结束后会调用此方法
     * @param collectionView
     */
    onScrollEnded(collectionView: YXCollectionView): void;
    /**
     * @optional
     * 返回区域内可见的节点属性，并实时的调整这些节点变换效果 (如果在这个方法里调整了节点变换属性，需要重写 shouldUpdateAttributesForBoundsChange 以支持实时变换)
     * 根据实际的布局情况，计算出当前屏幕内需要显示的布局属性
     * 这个方法会直接影响到列表的性能，如果在自定义的时候对性能要求不高(比如明确知道数据量不多的情况下)，可以忽略此方法 (默认会检查所有的布局属性并返回所有的处于可见范围内的单元格布局属性)
     * @param rect 当前滚动视图的可见区域
     */
    layoutAttributesForElementsInRect(rect: math.Rect, collectionView: YXCollectionView): YXLayoutAttributes[];
    /**
     * @optional
     * 通过索引查找布局属性，默认 Array.find()
     * @param indexPath
     * @param collectionView
     */
    layoutAttributesForItemAtIndexPath(indexPath: YXIndexPath, collectionView: YXCollectionView): YXLayoutAttributes;
    /**
     * @optional
     * YXCollectionView 在调用 @scrollTo 方法时会触发这个方法，如果实现了这个方法，最终的滚动停止位置以这个方法返回的为准
     * @param indexPath
     * @returns 滚动视图偏移位置
     */
    scrollTo(indexPath: YXIndexPath, collectionView: YXCollectionView): math.Vec2;
    /**
     * @optional
     * @see YXLayoutAttributes.zIndex
     * @returns
     */
    shouldUpdateAttributesZIndex(): boolean;
    /**
     * @optional
     * @see YXLayoutAttributes.opacity
     * @returns
     */
    shouldUpdateAttributesOpacity(): boolean;
    /**
     * @optional
     * 此布局下的节点，是否需要实时更新变换效果
     * @returns 返回 true 会忽略 YXCollectionView 的 frameInterval 设置，强制在滚动过程中实时更新节点
     */
    shouldUpdateAttributesForBoundsChange(): boolean;
}
/**
 * 把二分查找的规则抽出来封装一下，继承这个类的布局，默认通过二分查找实现查找业务
 * 这种查找规则对数据量很大的有序列表来说相对高效，具体是否使用还是要根据实际排列需求决定
 */
export declare abstract class YXBinaryLayout extends YXLayout {
    /**
     * @bug 如果节点大小差距很大，可能会导致计算屏幕内节点时不准确，出现节点不被正确添加到滚动视图上的问题
     * @fix 可以通过此属性，追加屏幕显示的节点数量
     * 设置这个值会在检查是否可见的节点时，尝试检查更多的可能处于屏幕外的节点，具体设置多少要根据实际情况调试，一般如果都是正常大小的节点，不需要考虑这个配置
     * 设置负值会检查所有的节点
     */
    extraVisibleCount: number;
    layoutAttributesForElementsInRect(rect: math.Rect, collectionView: YXCollectionView): YXLayoutAttributes[];
    layoutAttributesForItemAtIndexPath(indexPath: YXIndexPath, collectionView: YXCollectionView): YXLayoutAttributes;
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
export declare class YXCollectionView extends Component {
    /**
     * 访问定义的私有枚举
     */
    static ScrollDirection: typeof _yx_collection_view_scroll_direction;
    static Mode: typeof _yx_collection_view_list_mode;
    /**
     * 滚动视图组件
     */
    get scrollView(): ScrollView;
    /**
     * 允许手势滚动
     */
    scrollEnabled: boolean;
    /**
     * 允许鼠标滑轮滚动
     */
    wheelScrollEnabled: boolean;
    /**
     * 列表滚动方向，默认垂直方向滚动
     * 自定义 YXLayout 应该尽量根据这个配置来实现不同方向的布局业务
     * 注意: 如果使用的 YXLayout 未支持对应的滚动方向，则此配置不会生效
     */
    scrollDirection: YXCollectionView.ScrollDirection;
    /**
     * 列表单元节点加载模式
     */
    mode: YXCollectionView.Mode;
    /**
     * 预加载模式下每帧加载多少个节点
     */
    preloadNodesLimitPerFrame: number;
    /**
     * 预加载进度
     */
    preloadProgress: (current: number, total: number) => void;
    /**
     * 每多少帧刷新一次可见节点，1 表示每帧都刷
     */
    frameInterval: number;
    /**
     * 滚动过程中，每多少帧回收一次不可见节点，1表示每帧都回收，0表示不在滚动过程中回收不可见节点
     * @bug 滚动过程中如果实时的回收不可见节点，有时候会收不到 scroll view 的 cancel 事件，导致 scroll view 的滚动状态不会更新 (且收不到滚动结束事件)
     * @fix 当这个属性设置为 0 时，只会在 `touch-up` 和 `scroll-ended` 里面回收不可见节点
     */
    recycleInterval: number;
    /**
     * 注册 cell
     * 可多次注册不同种类的 cell，只要确保 @identifier 的唯一性就好
     * @param identifier cell 标识符，通过 @dequeueReusableCell 获取重用 cell 时，会根据这个值匹配
     * @param maker 生成节点，当重用池里没有可用的节点时，会通过这个回调获取节点，需要在这个回调里面生成节点
     * @param poolComp (可选) 节点自定义组件，可以通过这个组件跟 @NodePool 的重用业务关联起来
     */
    register(identifier: string, maker: () => Node, poolComp?: (new (...args: any[]) => YXCollectionViewCell) | string | null): void;
    /**
     * 通过标识符从重用池里取出一个可用的 cell 节点
     * @param identifier 注册时候的标识符
     * @returns
     */
    dequeueReusableCell(identifier: string): Node;
    /**
     * 内容要分几个区展示，默认 1
     * 没有分区展示的需求可以不管这个配置
     */
    numberOfSections: number | ((collectionView: YXCollectionView) => number);
    getNumberOfSections(): number;
    /**
     * 每个区里要展示多少条内容
     */
    numberOfItems: number | ((section: number, collectionView: YXCollectionView) => number);
    getNumberOfItems(section: number): number;
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
    cellForItemAt: (indexPath: YXIndexPath, collectionView: YXCollectionView) => Node;
    /**
     * 当 cell 进入当前可见范围后执行
     * 如果同类型的节点大小可能不一样，可以在这里调整子节点的位置
     */
    onCellDisplay: (cell: Node, indexPath: YXIndexPath, collectionView: YXCollectionView) => void;
    /**
     * 当 cell 移出当前可见范围后执行
     */
    onCellEndDisplay: (cell: Node, indexPath: YXIndexPath, collectionView: YXCollectionView) => void;
    /**
     * 点击到节点后执行这个方法
     */
    onTouchItemAt: (indexPath: YXIndexPath, collectionView: YXCollectionView) => void;
    /**
     * 布局规则
     */
    layout: YXLayout;
    /**
     * 获取列表当前的可见范围
     */
    get visibleRect(): math.Rect;
    /**
     * 获取当前正在显示的所有节点/组件
     */
    get visibleNodes(): Node[];
    get visibleCells(): YXCollectionView.Cell[];
    /**
     * 获取当前正在显示的某个节点/组件
     * @param indexPath
     */
    getVisibleNode(indexPath: YXIndexPath): Node | null;
    getVisibleCell(indexPath: YXIndexPath): YXCollectionView.Cell | null;
    /**
     * 获取指定节点的私有 cell 组件
     */
    getCellComp(node: Node): YXCollectionView.Cell | null;
    /**
     * 刷新列表数据
     */
    reloadData(): void;
    /**
     * 滚动到指定节点的位置
     * @returns
     */
    scrollTo(indexPath: YXIndexPath, timeInSecond?: number, attenuated?: boolean): void;
    /**
     * 生命周期方法
     */
    protected onLoad(): void;
    protected onDestroy(): void;
    protected update(dt: number): void;
    /**
     * 刷新当前可见节点
     * @param force true: 立即刷新  false: 下帧刷新
     */
    markForUpdateVisibleData(force?: boolean): void;
}
export declare namespace YXCollectionView {
    /**
     * 重定义私有类型
     */
    type ScrollDirection = _yx_collection_view_scroll_direction;
    type Mode = _yx_collection_view_list_mode;
    type Cell = _yx_readonly_deep<_cell_>;
}
export { };
