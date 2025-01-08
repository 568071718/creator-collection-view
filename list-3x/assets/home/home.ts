import { _decorator, Component, Label, math, Node, Sprite } from 'cc';
import { YXCollectionView } from '../lib/yx-collection-view';
import { YXTableLayout } from '../lib/yx-table-layout';
const { ccclass, property } = _decorator;


@ccclass('home')
export class home extends Component {

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
            cell.getChildByName('label').getComponent(Label).string = `${indexPath}`
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
                supplementary.getChildByName('label').getComponent(Label).string = `header  ${indexPath}`
                const shape = supplementary.getChildByName('shape')
                shape.getComponent(Sprite).color = new math.Color(100, 100, 150)
                return supplementary
            }
            if (kinds === YXTableLayout.SupplementaryKinds.FOOTER) {
                const supplementary = collectionView.dequeueReusableSupplementary('supplementary')
                supplementary.getChildByName('label').getComponent(Label).string = `footer  ${indexPath}`
                const shape = supplementary.getChildByName('shape')
                shape.getComponent(Sprite).color = new math.Color(150, 100, 100)
                return supplementary
            }
            return null
        }

        listComp.numberOfItems = () => 20
        listComp.cellForItemAt = (indexPath, collectionView) => {
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(Label).string = `${indexPath}`
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
                supplementary.getChildByName('label').getComponent(Label).string = `header  ${indexPath}`
                const shape = supplementary.getChildByName('shape')
                shape.getComponent(Sprite).color = new math.Color(100, 100, 150)
                return supplementary
            }
            if (kinds === YXTableLayout.SupplementaryKinds.FOOTER) {
                const supplementary = collectionView.dequeueReusableSupplementary('supplementary')
                supplementary.getChildByName('label').getComponent(Label).string = `footer  ${indexPath}`
                const shape = supplementary.getChildByName('shape')
                shape.getComponent(Sprite).color = new math.Color(150, 100, 100)
                return supplementary
            }
            return null
        }

        listComp.numberOfItems = () => 20
        listComp.cellForItemAt = (indexPath, collectionView) => {
            const cell = collectionView.dequeueReusableCell(`cell`)
            cell.getChildByName('label').getComponent(Label).string = `${indexPath}`
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

