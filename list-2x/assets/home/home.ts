// Learn TypeScript:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/2.4/manual/en/scripting/life-cycle-callbacks.html

import { YXCollectionView } from "../lib/yx-collection-view";
import { YXTableLayout } from "../lib/yx-table-layout";

const { ccclass, property } = cc._decorator;


@ccclass
export default class NewClass extends cc.Component {

    protected start(): void {
        this.setup_list1()
        this.setup_list2()
        this.setup_list3()
    }
    
    setup_list1() {
        const listComp = this.node.getChildByName('list1').getComponent(YXCollectionView)

        listComp.numberOfItems = () => 10000
        listComp.cellForItemAt = (indexPath, collectionView) => {
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(cc.Label).string = `${indexPath}`
            return cell
        }

        let layout = new YXTableLayout()
        layout.spacing = 20
        layout.rowHeight = 100
        listComp.layout = layout

        listComp.reloadData()
    }

    setup_list2() {
        const listComp = this.node.getChildByName('list2').getComponent(YXCollectionView)

        listComp.numberOfSections = () => 100
        listComp.supplementaryForItemAt = (indexPath, collectionView, kinds) => {
            if (kinds === YXTableLayout.SupplementaryKinds.HEADER) {
                const supplementary = collectionView.dequeueReusableSupplementary('supplementary')
                supplementary.getChildByName('label').getComponent(cc.Label).string = `header  ${indexPath}`
                const shape = supplementary.getChildByName('shape')
                shape.color = new cc.Color(100, 100, 150)
                return supplementary
            }
            if (kinds === YXTableLayout.SupplementaryKinds.FOOTER) {
                const supplementary = collectionView.dequeueReusableSupplementary('supplementary')
                supplementary.getChildByName('label').getComponent(cc.Label).string = `footer  ${indexPath}`
                const shape = supplementary.getChildByName('shape')
                shape.color = new cc.Color(150, 100, 100)
                return supplementary
            }
            return null
        }

        listComp.numberOfItems = () => 20
        listComp.cellForItemAt = (indexPath, collectionView) => {
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(cc.Label).string = `${indexPath}`
            return cell
        }

        let layout = new YXTableLayout()
        layout.spacing = 20
        layout.top = 20
        layout.bottom = 20
        layout.rowHeight = 100
        layout.sectionHeaderHeight = 120
        layout.sectionFooterHeight = 120
        listComp.layout = layout

        listComp.reloadData()
    }

    setup_list3() {
        const listComp = this.node.getChildByName('list3').getComponent(YXCollectionView)

        listComp.numberOfSections = () => 100
        listComp.supplementaryForItemAt = (indexPath, collectionView, kinds) => {
            if (kinds === YXTableLayout.SupplementaryKinds.HEADER) {
                const supplementary = collectionView.dequeueReusableSupplementary('supplementary')
                supplementary.getChildByName('label').getComponent(cc.Label).string = `header  ${indexPath}`
                const shape = supplementary.getChildByName('shape')
                shape.color = new cc.Color(100, 100, 150)
                return supplementary
            }
            if (kinds === YXTableLayout.SupplementaryKinds.FOOTER) {
                const supplementary = collectionView.dequeueReusableSupplementary('supplementary')
                supplementary.getChildByName('label').getComponent(cc.Label).string = `footer  ${indexPath}`
                const shape = supplementary.getChildByName('shape')
                shape.color = new cc.Color(150, 100, 100)
                return supplementary
            }
            return null
        }

        listComp.numberOfItems = () => 20
        listComp.cellForItemAt = (indexPath, collectionView) => {
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(cc.Label).string = `${indexPath}`
            return cell
        }

        let layout = new YXTableLayout()
        layout.spacing = 20
        layout.top = 20
        layout.bottom = 20
        layout.rowHeight = 100
        layout.sectionHeaderHeight = 120
        layout.sectionFooterHeight = 120
        layout.sectionHeadersPinToVisibleBounds = true
        layout.sectionFootersPinToVisibleBounds = true
        listComp.layout = layout

        listComp.reloadData()
    }
}
