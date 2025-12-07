import { _decorator, Component, Label, math, Node, Sprite } from 'cc';
import { YXCollectionView } from '../lib/yx-collection-view';
import { YXTableLayout } from '../lib/yx-table-layout';
const { ccclass, property } = _decorator;

let __ID__ = 0
const data = [
    {
        id: __ID__++,
        title: "DATA-A",
        list: [
            { name: "data-a-1" },
            { name: "data-a-2" },
            { name: "data-a-3" },
            { name: "data-a-4" },
            { name: "data-a-5" },
        ]
    },
    {
        id: __ID__++,
        title: "DATA-B",
        list: [
            { name: "data-b-1" },
            { name: "data-b-2" },
            { name: "data-b-3" },
            { name: "data-b-4" },
            { name: "data-b-5" },
        ]
    },
    {
        id: __ID__++,
        title: "DATA-C",
        list: [
            { name: "data-c-1" },
            { name: "data-c-2" },
            { name: "data-c-3" },
            { name: "data-c-4" },
            { name: "data-c-5" },
        ]
    },
    {
        id: __ID__++,
        title: "DATA-D",
        list: [
            { name: "data-d-1" },
            { name: "data-d-2" },
            { name: "data-d-3" },
            { name: "data-d-4" },
            { name: "data-d-5" },
        ]
    },
    {
        id: __ID__++,
        title: "DATA-E",
        list: [
            { name: "data-e-1" },
            { name: "data-e-2" },
            { name: "data-e-3" },
            { name: "data-e-4" },
            { name: "data-e-5" },
        ]
    },
]

@ccclass('table_sublist')
export class table_sublist extends Component {
    openIds = new Map<number, boolean>()
    protected start(): void {
        const listComp = this.node.getChildByName('list').getComponent(YXCollectionView)

        listComp.numberOfSections = () => {
            return data.length
        }

        listComp.numberOfItems = (section) => {
            let sectionData = data[section]
            let isOpen = this.openIds.get(sectionData.id) ?? false
            if (isOpen) {
                return data[section].list.length
            }
            return 0
        }

        listComp.supplementaryForItemAt = (indexPath, collectionView, kinds) => {
            let sectionData = data[indexPath.section]
            if (kinds === YXTableLayout.SupplementaryKinds.HEADER) {
                const header = collectionView.dequeueReusableSupplementary(`header`)
                header.getChildByName('label').getComponent(Label).string = sectionData.title + "\n" + "点击展开/收起子列表"
                header.getChildByName('shape').getComponent(Sprite).color = new math.Color(100, 100, 200)
                return header
            }

            return null
        }

        listComp.cellForItemAt = (indexPath, collectionView) => {
            let rowData = data[indexPath.section].list[indexPath.row]
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(Label).string = rowData.name
            return cell
        }

        listComp.onTouchSupplementaryAt = (indexPath, collectionView, kinds) => {
            let sectionData = data[indexPath.section]
            if (kinds === YXTableLayout.SupplementaryKinds.HEADER) {
                let isOpen = this.openIds.get(sectionData.id) ?? false
                this.openIds.set(sectionData.id, !isOpen) // 取反
                collectionView.reloadData()
            }
        }

        let layout = new YXTableLayout()
        layout.top = 10
        layout.spacing = 10
        layout.bottom = 10
        layout.rowHeight = 120
        layout.sectionHeaderHeight = 150
        // 这个属性用来控制 header 是否悬浮  
        layout.sectionHeadersPinToVisibleBounds = false
        listComp.layout = layout

        listComp.reloadData()
    }
}


