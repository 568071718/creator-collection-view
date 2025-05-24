import { math, UITransform, warn } from "cc";
import { YXCollectionView, YXIndexPath, YXLayout, YXLayoutAttributes } from "./yx-collection-view";

export class GridLayout extends YXLayout {

    /**
     * 节点大小  
     */
    itemSize: math.Size = new math.Size(100, 100)

    /**
     * 垂直间距  
     */
    horizontalSpacing: number = 0

    /**
     * 水平间距  
     */
    verticalSpacing: number = 0

    /**
     * 整体对齐方式  
     * 0靠左 1居中 2靠右  
     */
    alignment: number = 1

    /**
     * 获取每行最多可以容纳多少个节点  
     */
    protected getMaxItemsPerRow(collectionView: YXCollectionView): number {
        if (this._maxItemsPerRow == null) {
            let num = 1
            const width = collectionView.node.getComponent(UITransform).contentSize.width
            while ((num * this.itemSize.width + (num - 1) * this.horizontalSpacing) <= width) { num++ }
            num = Math.max(1, num - 1)
            this._maxItemsPerRow = num
        }
        return this._maxItemsPerRow
    }
    protected _maxItemsPerRow: number = null

    prepare(collectionView: YXCollectionView): void {
        if (collectionView.scrollDirection === YXCollectionView.ScrollDirection.VERTICAL) {
            this._prepare_vertical(collectionView)
            return
        }
        if (collectionView.scrollDirection === YXCollectionView.ScrollDirection.HORIZONTAL) {
            warn(`GridLayout 仅支持垂直方向排列`)
            this._prepare_vertical(collectionView)
            return
        }
    }

    protected _prepare_vertical(collectionView: YXCollectionView) {
        collectionView.scrollView.horizontal = false
        collectionView.scrollView.vertical = true

        let attrs: YXLayoutAttributes[] = []
        let contentSize = collectionView.node.getComponent(UITransform).contentSize.clone()

        // 容器宽度
        const width = contentSize.width

        // 计算每行最多可以放多少个节点
        this._maxItemsPerRow = null
        let num = this.getMaxItemsPerRow(collectionView)

        // 根据设置的对齐方式计算左边距
        let left = 0
        if (this.alignment == 1) {
            let maxWidth = (num * this.itemSize.width + (num - 1) * this.horizontalSpacing) // 每行节点总宽度
            left = (width - maxWidth) * 0.5
        }
        if (this.alignment == 2) {
            let maxWidth = (num * this.itemSize.width + (num - 1) * this.horizontalSpacing) // 每行节点总宽度
            left = width - maxWidth
        }

        const numberOfSections = collectionView.getNumberOfSections()
        if (numberOfSections > 1) { warn(`GridLayout 暂时不支持分区模式`) }

        const numberOfItems = collectionView.getNumberOfItems(0)
        for (let index = 0; index < numberOfItems; index++) {

            // 计算这个节点是第几行
            let row = Math.floor(index / num)

            // 计算这个节点是第几列
            let column = index % num

            // 计算节点 origin
            let x = left + (this.itemSize.width + this.horizontalSpacing) * column
            let y = (this.itemSize.height + this.verticalSpacing) * row

            let attr = YXLayoutAttributes.layoutAttributesForCell(new YXIndexPath(0, index))
            attr.frame.x = x
            attr.frame.y = y
            attr.frame.width = this.itemSize.width
            attr.frame.height = this.itemSize.height
            attrs.push(attr)

            // 更新内容高度
            contentSize.height = Math.max(contentSize.height, attr.frame.yMax)
        }

        this.attributes = attrs
        this.contentSize = contentSize
    }

    initOffset(collectionView: YXCollectionView): void {
        collectionView.scrollView.scrollToTop()
    }

    layoutAttributesForElementsInRect(rect: math.Rect, collectionView: YXCollectionView): YXLayoutAttributes[] {
        return this.visibleElementsInRect(rect, collectionView)
    }

    /**
     * 抽出来一个方法用来优化列表性能  
     * 在优化之前，可以先看一下 @see YXLayout.layoutAttributesForElementsInRect 关于返回值的说明  
     */
    protected visibleElementsInRect(rect: math.Rect, collectionView: YXCollectionView) {
        if (this.attributes.length <= 100) { return this.attributes } // 少量数据就不查了，直接返回全部  

        // 根据当前范围直接计算出一个区间  
        const startRow = Math.floor(rect.y / (this.itemSize.height + this.verticalSpacing))
        const endRow = Math.ceil(rect.yMax / (this.itemSize.height + this.verticalSpacing))

        // 计算每行最多可以放多少个节点
        let num = this.getMaxItemsPerRow(collectionView)

        // 计算索引区间
        const startIdx = Math.max(startRow * num, 0) // 防止<0：当列表置顶往下滑时（rect.y < 0）得出startIdx为负数，导致slice截取为空（表现是回弹过程列表元素截断）
        const endIdx = endRow * num

        // 只返回区间节点的布局属性
        return this.attributes.slice(startIdx, endIdx)
    }
}

