
使 table-layout 支持区头/区尾配置  

```ts
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
     * 区头/区尾标识  
     */
    static SupplementaryKinds = _yx_table_layout_supplementary_kinds

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

                // 重要: 保存布局属性
                this.attributes.push(headerAttr)

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

                // 重要: 保存布局属性
                this.attributes.push(footerAttr)

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
}
```
