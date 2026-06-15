import React, { useEffect, useState, useMemo } from 'react';
import { Card, Tree, Button, Typography, Space, Modal, Form, Input, Select, message, List, Tag, Empty, Row, Col } from 'antd';
import { PlusOutlined, ReloadOutlined, EnvironmentOutlined, ApartmentOutlined } from '@ant-design/icons';
import { locationsAPI, departmentsAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import InfoButton from '../components/InfoButton';

const { Title, Text } = Typography;

// 6 областей з >1 підрозділом — дерева-блоки з фіксованим порядком
const BLOCK_REGIONS = ['Київська', 'Харківська', 'Полтавська', 'Рівненська', 'Одеська', 'Житомирська'];

const LocationsPage = () => {
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [sel, setSel] = useState(null);
  const [assetsList, setAssetsList] = useState([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const { user } = useAuthStore();

  const load = async () => { setLoading(true); try { const r = await locationsAPI.getAll(); setLocations(r.data); } catch (e) { message.error('Помилка'); } finally { setLoading(false); } };
  useEffect(() => { load(); departmentsAPI.getAll().then((r) => setDepartments(r.data)).catch(() => {}); }, []);

  const grouped = useMemo(() => {
    const byDept = {};
    locations.forEach((l) => { (byDept[l.department_id] = byDept[l.department_id] || { name: l.department_name, items: [] }).items.push(l); });
    return byDept;
  }, [locations]);

  const buildDeptTree = (dept) => {
    const items = dept.items;
    const byBuilding = {};
    items.forEach((l) => { const b = l.building || '(без будівлі)'; (byBuilding[b] = byBuilding[b] || []).push(l); });
    return Object.keys(byBuilding).sort().map((b) => ({
      title: b, key: 'b-' + dept.name + '-' + b, selectable: false,
      children: byBuilding[b].map((l) => ({ title: [l.floor && (l.floor + 'п'), l.room && ('к.' + l.room)].filter(Boolean).join(' ') || '(приміщення)', key: 'l-' + l.location_id, isLeaf: true, location: l })),
    }));
  };

  const blockDepts = useMemo(() => BLOCK_REGIONS.map((n) => departments.find((d) => d.name === n)).filter(Boolean).filter((d) => grouped[d.department_id]), [departments, grouped]);
  const otherDepts = useMemo(() => departments.filter((d) => !BLOCK_REGIONS.includes(d.name) && grouped[d.department_id]).sort((a, b) => a.name.localeCompare(b.name)), [departments, grouped]);

  const onSelect = async (_keys, info) => {
    const node = info && info.node;
    if (node && node.location) {
      setSel(node.location); setAssetsLoading(true);
      try { const r = await locationsAPI.assets(node.location.location_id); setAssetsList(r.data); } catch (e) { message.error('Помилка'); } finally { setAssetsLoading(false); }
    }
  };

  const TreeBlock = ({ dept, expanded }) => (
    <Card size="small" title={<span><ApartmentOutlined /> {dept.name}</span>} style={{ height: '100%' }}>
      <Tree showIcon defaultExpandAll={expanded} treeData={buildDeptTree(grouped[dept.department_id])} onSelect={onSelect} />
    </Card>
  );

  const openCreate = () => { form.resetFields(); form.setFieldsValue({ department_id: (departments[0] && departments[0].department_id) }); setOpen(true); };
  const submit = async (values) => {
    setSubmitting(true);
    try { await locationsAPI.create(values); message.success('Приміщення створено'); setOpen(false); load(); }
    catch (e) { message.error(e.response?.data?.message || 'Помилка'); } finally { setSubmitting(false); }
  };
  const selTitle = sel ? [sel.building, sel.floor && (sel.floor + 'п'), sel.room && ('к.' + sel.room)].filter(Boolean).join(', ') : '';

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><Title level={2} style={{ margin: 0 }}>Приміщення</Title><Text type="secondary">Дерева підрозділів: будівлі → поверхи/кімнати</Text></div>
          <Space>
            <InfoButton title="Приміщення" items={[
              { title: 'Створення', text: 'окремою кнопкою; в актах приміщень немає. Будівлі підрозділу показано в рядок (плиткою).' },
              { title: 'Дерева-блоки', text: '6 областей з >1 підрозділом (Київська, Харківська, Полтавська, Рівненська, Одеська, Житомирська) — фіксований порядок; решта — за алфавітом.' },
              { title: 'Майно в приміщенні', text: 'клік по кінцевому вузлу показує всі одиниці, що там перебувають.' },
            ]} />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Додати приміщення</Button>
          </Space>
        </div>

        {blockDepts.length > 0 && (
          <Card title="Області з кількома підрозділами" loading={loading}>
            <Row gutter={[12, 12]}>
              {blockDepts.map((d) => (
                <Col key={d.department_id} xs={24} sm={12} md={8} lg={6}>
                  <TreeBlock dept={d} expanded />
                </Col>
              ))}
            </Row>
          </Card>
        )}

        <Card title="Інші області" loading={loading} extra={<Button type="text" icon={<ReloadOutlined />} onClick={load} />}>
          {otherDepts.length ? (
            <Row gutter={[12, 12]}>
              {otherDepts.map((d) => (
                <Col key={d.department_id} xs={24} sm={12} md={8} lg={6}>
                  <TreeBlock dept={d} />
                </Col>
              ))}
            </Row>
          ) : <Empty description="Немає приміщень" />}
        </Card>
      </Space>

      <Modal title="Створити приміщення" open={open} onCancel={() => setOpen(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item label="Підрозділ" name="department_id" rules={[{ required: true }]}><Select disabled={user?.role !== 'global_admin'}>{departments.map((d) => <Select.Option key={d.department_id} value={d.department_id}>{d.name}</Select.Option>)}</Select></Form.Item>
          <Form.Item label="Будівля" name="building" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label="Поверх (необов'язково)" name="floor"><Input /></Form.Item>
          <Form.Item label="Кімната (необов'язково)" name="room"><Input /></Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}><Space><Button onClick={() => setOpen(false)}>Скасувати</Button><Button type="primary" htmlType="submit" loading={submitting}>Створити</Button></Space></Form.Item>
        </Form>
      </Modal>

      <Modal title={'Майно в приміщенні: ' + selTitle} open={!!sel} onCancel={() => setSel(null)} footer={null} width={600}>
        <List loading={assetsLoading} dataSource={assetsList} locale={{ emptyText: 'Майна немає' }}
          renderItem={(a) => (<List.Item><List.Item.Meta title={`${a.inventory_number} — ${a.name}`} description={`${a.responsible_full_name || a.responsible_username || '—'} · ${a.department_name || ''}`} /><Tag>{a.status}</Tag></List.Item>)} />
      </Modal>
    </div>
  );
};

export default LocationsPage;
