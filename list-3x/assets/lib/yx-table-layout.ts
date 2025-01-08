import { log, math, UITransform, warn } from "cc";
import { YXCollectionView, YXIndexPath, YXLayout, YXLayoutAttributes } from "./yx-collection-view";

enum _yx_table_layout_supplementary_kinds {
    HEADER = 'header',
    FOOTER = 'footer',
}

export class YXTableLayout extends YXLayout {

    /**
     * 行高  
     */
    rowHeight: number | ((indexPath: YXIndexPath) => number) = 100

    /**
     * 内容上边距
     */
    top: number = 0

    /**
     * 内容下边距
     */
    bottom: number = 0

    /**
     * 节点之间间距  
     */
    spacing: number = 0

    /**
     * 区头高度
     */
    sectionHeaderHeight: number | ((section: number) => number) = null

    /**
     * 区尾高度
     */
    sectionFooterHeight: number | ((section: number) => number) = null

    /**
     * 钉住 header 的位置 ( header 吸附在列表可见范围内 )  
     */
    sectionHeadersPinToVisibleBounds: boolean = false

    /**
     * 钉住 footer 的位置 ( footer 吸附在列表可见范围内 )  
     */
    sectionFootersPinToVisibleBounds: boolean = false

    /**
     * 区头/区尾标识  
     */
    static SupplementaryKinds = _yx_table_layout_supplementary_kinds

    protected originalHeaderRect: Map<number, math.Rect> = new Map() // 保存所有 header 的原始位置
    protected originalFooterRect: Map<number, math.Rect> = new Map() // 保存所有 footer 的原始位置

    // 为了优化查找，额外维护几个数组按类别管理所有的布局属性，空间换时间  
    protected allCellAttributes: YXLayoutAttributes[] = []
    protected allHeaderAttributes: YXLayoutAttributes[] = []
    protected allFooterAttributes: YXLayoutAttributes[] = []

    prepare(collectionView: YXCollectionView): void {
        // 设置列表的滚动方向(这套布局固定为垂直方向滚动)  
        collectionView.scrollView.horizontal = false
        collectionView.scrollView.vertical = true
        if (collectionView.scrollDirection === YXCollectionView.ScrollDirection.HORIZONTAL) {
            // 由于这套布局规则只支持垂直方向布局，当外部配置了水平方向滚动时这里可以给个警告  
            warn(`YXTableLayout 仅支持垂直方向排列`)
        }

        // 清空一下布局属性数组
        this.attributes = []
        this.allCellAttributes = []
        this.allHeaderAttributes = []
        this.allFooterAttributes = []
        this.originalHeaderRect.clear()
        this.originalFooterRect.clear()

        // 获取列表宽度  
        const contentWidth = collectionView.node.getComponent(UITransform).width

        // 声明一个临时变量，用来记录当前所有内容的总高度  
        let contentHeight = 0

        // 获取列表一共分多少个区
        let numberOfSections = collectionView.getNumberOfSections()

        // 为每条数据对应的生成一个布局属性
        for (let section = 0; section < numberOfSections; section++) {

            // 创建一个区索引
            let sectionIndexPath = new YXIndexPath(section, 0)

            // 通过区索引创建一个区头节点布局属性
            let sectionHeaderHeight = 0
            if (this.sectionHeaderHeight) {
                sectionHeaderHeight = this.sectionHeaderHeight instanceof Function ? this.sectionHeaderHeight(section) : this.sectionHeaderHeight
            }
            if (sectionHeaderHeight > 0) {
                let headerAttr = YXLayoutAttributes.layoutAttributesForSupplementary(sectionIndexPath, YXTableLayout.SupplementaryKinds.HEADER)

                // 确定这个节点的位置  
                headerAttr.frame.x = 0
                headerAttr.frame.width = contentWidth
                headerAttr.frame.height = sectionHeaderHeight
                headerAttr.frame.y = contentHeight

                // 调整层级
                headerAttr.zIndex = 1

                // 重要: 保存布局属性
                this.attributes.push(headerAttr)
                this.originalHeaderRect.set(section, headerAttr.frame.clone())
                this.allHeaderAttributes.push(headerAttr)

                // 更新整体内容高度
                contentHeight = headerAttr.frame.yMax
            }

            // 将 top 配置应用到每个区  
            contentHeight = contentHeight + this.top

            // 获取这个区内的内容数量，注意这里传入的是 section  
            let numberOfItems = collectionView.getNumberOfItems(section)

            for (let item = 0; item < numberOfItems; item++) {

                // 创建索引，注意这里的 section 已经改为正确的 section 了  
                let indexPath = new YXIndexPath(section, item)

                // 通过索引创建一个 cell 节点的布局属性
                let attr = YXLayoutAttributes.layoutAttributesForCell(indexPath)

                // 通过索引获取这个节点的高度
                let rowHeight = this.rowHeight instanceof Function ? this.rowHeight(indexPath) : this.rowHeight

                // 确定这个节点的位置  
                attr.frame.x = 0
                attr.frame.width = contentWidth
                attr.frame.height = rowHeight
                attr.frame.y = contentHeight + (item > 0 ? this.spacing : 0)

                // 重要: 保存布局属性
                this.attributes.push(attr)
                this.allCellAttributes.push(attr)

                // 更新当前内容高度
                contentHeight = attr.frame.yMax
            }

            // 高度补一个底部间距，跟 top 一样，也是应用到每个区  
            contentHeight = contentHeight + this.bottom

            // 通过区索引创建一个区尾节点布局属性
            let sectionFooterHeight = 0
            if (this.sectionFooterHeight) {
                sectionFooterHeight = this.sectionFooterHeight instanceof Function ? this.sectionFooterHeight(section) : this.sectionFooterHeight
            }
            if (sectionFooterHeight > 0) {
                let footerAttr = YXLayoutAttributes.layoutAttributesForSupplementary(sectionIndexPath, YXTableLayout.SupplementaryKinds.FOOTER)

                // 确定这个节点的位置  
                footerAttr.frame.x = 0
                footerAttr.frame.width = contentWidth
                footerAttr.frame.height = sectionFooterHeight
                footerAttr.frame.y = contentHeight

                // 调整层级
                footerAttr.zIndex = 1

                // 重要: 保存布局属性
                this.attributes.push(footerAttr)
                this.originalFooterRect.set(section, footerAttr.frame.clone())
                this.allFooterAttributes.push(footerAttr)

                // 更新整体内容高度
                contentHeight = footerAttr.frame.yMax
            }
        }

        // 重要: 设置内容区域总大小，只有确定了滚动区域的大小列表才能滚动  
        this.contentSize = new math.Size(contentWidth, contentHeight)
    }

    initOffset(collectionView: YXCollectionView): void {
        // 列表首次刷新时，调整一下列表的偏移位置  
        collectionView.scrollView.scrollToTop()
    }

    layoutAttributesForElementsInRect(rect: math.Rect, collectionView: YXCollectionView): YXLayoutAttributes[] {
        let result = this.visibleElementsInRect(rect, collectionView)
        if (this.sectionHeadersPinToVisibleBounds == false && this.sectionFootersPinToVisibleBounds == false) {
            return result // 不需要调整节点位置，直接返回就好
        }

        let numberOfSections = collectionView.getNumberOfSections()
        let scrollOffset = collectionView.scrollView.getScrollOffset()
        for (let index = 0; index < result.length; index++) {
            const element = result[index];
            if (element.elementCategory === 'Supplementary') {

                if (this.sectionHeadersPinToVisibleBounds && element.supplementaryKinds === YXTableLayout.SupplementaryKinds.HEADER) {
                    const originalFrame = this.originalHeaderRect.get(element.indexPath.section)
                    element.frame.y = originalFrame.y
                    if (scrollOffset.y > originalFrame.y) {
                        element.frame.y = scrollOffset.y
                    }
                    const nextOriginalFrame = this.getNextOriginalFrame(element.indexPath.section, YXTableLayout.SupplementaryKinds.FOOTER, numberOfSections)
                    if (nextOriginalFrame) {
                        if (element.frame.yMax > nextOriginalFrame.y) {
                            element.frame.y = nextOriginalFrame.y - element.frame.height
                        }
                    }
                }

                if (this.sectionFootersPinToVisibleBounds && element.supplementaryKinds === YXTableLayout.SupplementaryKinds.FOOTER) {
                    let bottom = scrollOffset.y + collectionView.scrollView.view.height
                    const originalFrame = this.originalFooterRect.get(element.indexPath.section)
                    const previousOriginalFrame = this.getPreviousOriginalFrame(element.indexPath.section, YXTableLayout.SupplementaryKinds.HEADER)
                    element.frame.y = originalFrame.y
                    if (bottom < originalFrame.yMax) {
                        element.frame.y = bottom - element.frame.height
                        if (previousOriginalFrame) {
                            if (element.frame.y < previousOriginalFrame.yMax) {
                                element.frame.y = previousOriginalFrame.yMax
                            }
                        }
                    }
                }
            }
        }
        return result
    }

    shouldUpdateAttributesZIndex(): boolean {
        return this.sectionHeadersPinToVisibleBounds || this.sectionFootersPinToVisibleBounds
    }

    shouldUpdateAttributesForBoundsChange(): boolean {
        return this.sectionHeadersPinToVisibleBounds || this.sectionFootersPinToVisibleBounds
    }

    /**
     * 获取 `section` 下一个 header 或者 footer 的位置  
     */
    protected getNextOriginalFrame(section: number, kinds: _yx_table_layout_supplementary_kinds, total: number) {
        if (section >= total) { return null }
        if (kinds === YXTableLayout.SupplementaryKinds.HEADER) {
            let result = this.originalHeaderRect.get(section)
            if (result) { return result }
            return this.getNextOriginalFrame(section, YXTableLayout.SupplementaryKinds.FOOTER, total)
        }
        if (kinds === YXTableLayout.SupplementaryKinds.FOOTER) {
            let result = this.originalFooterRect.get(section)
            if (result) { return result }
            return this.getNextOriginalFrame(section + 1, YXTableLayout.SupplementaryKinds.HEADER, total)
        }
        return null
    }

    /**
     * 获取 `section` 前一个 header 或者 footer 的位置  
     */
    protected getPreviousOriginalFrame(section: number, kinds: _yx_table_layout_supplementary_kinds) {
        if (section < 0) { return null }
        if (kinds === YXTableLayout.SupplementaryKinds.HEADER) {
            let result = this.originalHeaderRect.get(section)
            if (result) { return result }
            return this.getPreviousOriginalFrame(section - 1, YXTableLayout.SupplementaryKinds.FOOTER)
        }
        if (kinds === YXTableLayout.SupplementaryKinds.FOOTER) {
            let result = this.originalFooterRect.get(section)
            if (result) { return result }
            return this.getPreviousOriginalFrame(section, YXTableLayout.SupplementaryKinds.HEADER)
        }
        return null
    }

    /**
     * 抽出来一个方法用来优化列表性能  
     * 在优化之前，可以先看一下 @see YXLayout.layoutAttributesForElementsInRect 关于返回值的说明  
     * 对于有序列表来说，一般都是可以通过二分查找来进行优化  
     */
    protected visibleElementsInRect(rect: math.Rect, collectionView: YXCollectionView) {
        if (this.attributes.length <= 100) { return this.attributes } // 少量数据就不查了，直接返回全部  

        let result: YXLayoutAttributes[] = []

        // header 跟 footer 暂时不考虑，数据相对来说不算很多，直接全部返回  
        result.push(...this.allHeaderAttributes)
        result.push(...this.allFooterAttributes)

        // 关于 cell，这里用二分查找来优化一下  
        // 首先通过二分先查出个大概位置  
        let midIdx = -1
        let left = 0
        let right = this.allCellAttributes.length - 1

        while (left <= right && right >= 0) {
            let mid = left + (right - left) / 2
            mid = Math.floor(mid)
            let attr = this.allCellAttributes[mid]
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

        // 二分查找出错了，返回全部的布局属性  
        if (midIdx < 0) {
            return this.attributes
        }

        // 把模糊查到这个先加进来
        result.push(this.allCellAttributes[midIdx])

        // 然后依次往前检查，直到超出当前的显示范围  
        let startIdx = midIdx
        while (startIdx > 0) {
            let idx = startIdx - 1
            let attr = this.allCellAttributes[idx]
            if (rect.intersects(attr.frame) == false) {
                break
            }
            result.push(attr)
            startIdx = idx
        }

        // 依次往后检查，直到超出当前的显示范围  
        let endIdx = midIdx
        while (endIdx < this.allCellAttributes.length - 1) {
            let idx = endIdx + 1
            let attr = this.allCellAttributes[idx]
            if (rect.intersects(attr.frame) == false) {
                break
            }
            result.push(attr)
            endIdx = idx
        }

        return result
    }
}


