import { log, math, warn } from "cc";
import { YXCollectionView, YXIndexPath, YXLayout, YXLayoutAttributes } from "./yx-collection-view";

/**
 * PageView 布局
 */
export class PageLayout extends YXLayout {
    /**
     * 是否开启分页效果  
     */
    private pagingEnabled: boolean = true

    /**
     * 分页效果开启时，自动吸附动画时间  
     */
    pagingAnimationDuration: number = 0.5

    /**
     * 循环滚动，默认关闭  
     * 注意: 当开启循环滚动时，YXCollectionView 需要额外设置 `ignoreScrollEndedDuringAutoScroll = true`  
     * 注意: 开启循环滚动会生成较大范围的 `indexPath`，在使用索引的时候需要进行取余处理   
     * 
     * @example  
     * listComp.ignoreScrollEndedDuringAutoScroll = true  
     * listComp.numberOfItems = () => {
     *      return <data-length>
     * }
     * listComp.cellForItemAt = (indexPath, collectionView) => {
     *      let index = indexPath.row % <data-length> // 通过取余获取真实数据索引  
     *      const cell = collectionView.dequeueReusableCell(`cell`)
     *      return cell
     * }
     */
    loop: boolean = false

    /**
     * 仅开启循环滚动时生效，由于循环滚动是伪循环，如果不间断的朝着某一个方向一直滑是会滑到头的 (就像苹果的闹钟时间可以滑到尽头...)    
     * 调整这个属性可以放大滚动范围，避免滑动到头穿帮  
     * 会生成额外的布局属性，建议范围 1 ~ 10，默认: 5 (实际情况可以看数据压力，数据不多的话可以设置更大)  
     */
    scrollRangeMultiplier: number = 5
    private get safeScrollRangeMultiplier(): number {
        let value = Math.floor(this.scrollRangeMultiplier)
        return Math.max(1, value)
    }

    prepare(collectionView: YXCollectionView): void {
        collectionView.scrollView.horizontal = true
        collectionView.scrollView.vertical = false
        if (collectionView.scrollDirection === YXCollectionView.ScrollDirection.VERTICAL) {
            warn(`PageLayout 仅支持水平方向排列`)
        }

        const numberOfSections = collectionView.getNumberOfSections()
        if (numberOfSections > 1) { warn(`GridLayout 暂时不支持分区模式`) }

        let contentSize = collectionView.scrollView.view.contentSize.clone()
        let attrs = []

        let itemSize = collectionView.scrollView.view.contentSize
        let numberOfItems = collectionView.getNumberOfItems(0)
        if (this.loop) {
            numberOfItems = numberOfItems * 3 * this.safeScrollRangeMultiplier
            if (collectionView.ignoreScrollEndedDuringAutoScroll == false) {
                warn(`PageLayout: 开启循环滚动时建议将 YXCollectionView.ignoreScrollEndedDuringAutoScroll 设置为 true`)
            }
        }
        for (let index = 0; index < numberOfItems; index++) {
            let attr = YXLayoutAttributes.layoutAttributesForCell(new YXIndexPath(0, index))
            attr.frame.x = itemSize.width * index
            attr.frame.y = 0
            attr.frame.width = itemSize.width
            attr.frame.height = itemSize.height
            attrs.push(attr)
            contentSize.width = Math.max(contentSize.width, attr.frame.xMax)
        }

        this.attributes = attrs
        this.contentSize = contentSize
    }

    initOffset(collectionView: YXCollectionView): void {
        if (this.loop) {
            let numberOfItems = collectionView.getNumberOfItems(0)
            let offset = new math.Vec2()
            offset.x = numberOfItems * this.safeScrollRangeMultiplier * collectionView.scrollView.view.width
            offset.y = 0
            collectionView.scrollView.scrollToOffset(offset, 0)
        } else {
            collectionView.scrollView.scrollToLeft()
        }
    }

    targetOffset(collectionView: YXCollectionView, touchMoveVelocity: math.Vec3, startOffset: math.Vec2, originTargetOffset: math.Vec2, originScrollDuration: number): { offset: math.Vec2; time?: number; attenuated?: boolean; } | null {
        if (this.pagingEnabled == false) {
            return null
        }
        let offset = collectionView.scrollView.getScrollOffset()
        offset.x = - offset.x
        let threshold = 0.2
        let idx = Math.round(offset.x / collectionView.scrollView.view.width)
        let r = touchMoveVelocity.x / collectionView.scrollView.view.width
        if (startOffset && Math.abs(r) >= threshold) {
            idx = Math.round(startOffset.x / collectionView.scrollView.view.width) + (r > 0 ? -1 : 1)
        }
        offset.x = idx * collectionView.scrollView.view.width
        return { offset: offset, time: this.pagingAnimationDuration }
    }

    layoutAttributesForElementsInRect(rect: math.Rect, collectionView: YXCollectionView): YXLayoutAttributes[] {
        if (collectionView.scrollView.view.width <= 0 || this.attributes.length <= 0) {
            return super.layoutAttributesForElementsInRect(rect, collectionView)
        }
        // 直接计算出当前元素位置，另外额外返回左右两边的元素
        let result = []
        let idx = Math.round(rect.x / collectionView.scrollView.view.width)
        let previousIdx = idx - 1
        let latterIdx = idx + 1
        if (idx >= 0 && idx < this.attributes.length) {
            result.push(this.attributes[idx])
        }
        if (previousIdx >= 0 && previousIdx < this.attributes.length && previousIdx != idx) {
            result.push(this.attributes[previousIdx])
        }
        if (latterIdx >= 0 && latterIdx < this.attributes.length && latterIdx != idx) {
            result.push(this.attributes[latterIdx])
        }
        return result
    }

    onScrollEnded(collectionView: YXCollectionView): void {
        if (this.loop == false) {
            return
        }
        let numberOfItems = collectionView.getNumberOfItems(0)
        let offset = collectionView.scrollView.getScrollOffset()
        offset.x = - offset.x
        let idx = Math.round(offset.x / collectionView.scrollView.view.width) % numberOfItems
        offset.x = collectionView.scrollView.view.width * (numberOfItems * this.safeScrollRangeMultiplier + idx)
        collectionView.scrollView.scrollToOffset(offset)
        // 直接设置滚动位置不会触发刷新，这里强制刷新一下
        collectionView.markForUpdateVisibleData(true)
    }
}