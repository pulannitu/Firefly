---
title: Elasticsearch基础文档
published: 2026-05-12
updated: 2026-05-12
pinned: false
description: "Elasticsearch，从基础概念到实践应用，整理搜索引擎、索引、查询和集群相关知识。"
image: "./images/20260512_1.webp"
tags: [ "Elasticsearch", "搜索引擎", "学习笔记" ]
category: 技术
draft: false
---

## 炼气期：先把组件装起来

修仙第一步，先引气入体；学 Elasticsearch 第一件事，也别急着谈倒排索引、分词、打分算法，先把本地环境跑起来。

### 安装 Elasticsearch

我本地已经有一个叫 `elasticsearch` 的容器在跑，镜像是 `elasticsearch:7.12.0`。它暴露了两个端口：

- `9200`：平时写接口、用浏览器、用 Postman 调 Elasticsearch，基本都是访问这个端口。
- `9300`：节点之间通信会用到的端口。现在只是单机学习，暂时不需要深究，先眼熟一下。

```powershell
docker run -d `
  --name elasticsearch `
  -p 9200:9200 `
  -p 9300:9300 `
  -e "discovery.type=single-node" `
  -e "ES_JAVA_OPTS=-Xms84m -Xmx512m" `
  -v "D:\workspace\software\IT\Docker\docker-volumes\docker-es\data:/usr/share/elasticsearch/data" `
  -v "D:\workspace\software\IT\Docker\docker-volumes\docker-es\plugins:/usr/share/elasticsearch/plugins" `
  -v "D:\workspace\software\IT\Docker\docker-volumes\docker-es\config\elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml" `
  elasticsearch:7.12.0
```

这里最关键的是 `discovery.type=single-node`。它的意思是告诉 Elasticsearch：别找其他节点了，我现在就是一个人闭关修炼。学习阶段用单节点模式最省心，不用一上来就被集群发现配置劝退。

我还给它挂了三个目录：

- `data`：存索引数据，容器删了数据也尽量别跟着一起飞升。
- `plugins`：后面装 IK 分词器会用到。
- `elasticsearch.yml`：放自己的配置。

### 安装 Kibana

光有 Elasticsearch 也能学，但一直用命令行敲请求，多少有点像摸黑翻储物袋。Kibana 就是它的可视化控制台，后面查索引、看 mapping、调试 DSL 都会方便很多。

因为 Kibana 需要访问 Elasticsearch，最好先建一个 Docker 网络，让两个容器在同一个网络里互相喊名字：

```powershell
docker network create es-net
docker network connect es-net elasticsearch
```

然后启动同版本的 Kibana：

```powershell
docker run -d `
  --name kibana `
  --network es-net `
  -p 5601:5601 `
  -e "ELASTICSEARCH_HOSTS=http://elasticsearch:9200" `
  kibana:7.12.0
```

启动完成后，浏览器访问：

```text
http://localhost:5601
```

如果页面能打开，说明炼气期的第二件法器也备好了。

### 安装 IK 分词器

Elasticsearch 默认分词器对英文比较友好，但处理中文时就不太懂人情世故了。比如一句“我喜欢学习搜索引擎”，默认分词可能拆得比较生硬。学习中文搜索时，IK 分词器基本绕不开。

IK 插件版本要和 Elasticsearch 版本对齐。我这里 ES 是 `7.12.0`，所以 IK 也要装 `7.12.0`：

```powershell
docker exec -it elasticsearch elasticsearch-plugin install https://get.infini.cloud/elasticsearch/analysis-ik/7.12.0
```

装完插件后需要重启容器：

```powershell
docker restart elasticsearch
```

重启之后可以进容器看一下插件列表：

```powershell
docker exec -it elasticsearch elasticsearch-plugin list
```

如果能看到 `analysis-ik`，就说明中文分词器已经就位。

装完之后可以直接用 `_analyze` 试一下分词效果：

```json
GET /_analyze
{
  "text": "风光百年，同归尘土。问道之心，终归难改，纵使蹉跎一生，也要争那一线天机。",
  "analyzer": "ik_smart"
}
```

IK 常用的分词模式主要有两个：

- `ik_smart`：智能切分模式，切得比较克制，会尽量保留更合理的词。例如一句话里能识别出较完整的词组时，它不会拆得太碎。适合大多数搜索场景，尤其是希望结果更稳一点的时候。
- `ik_max_word`：最细粒度切分模式，会尽可能多地拆出词。它会把一句话拆成更多 token，召回能力更强，但也可能带来更多噪声。适合需要尽量扩大匹配范围的场景。

IK 还有一个很实用的地方：可以自己扩展词库。告诉它哪些词不要乱拆，哪些词干脆不要参与搜索。

要扩展 IK 分词器的词库，需要修改 IK 插件目录下的配置文件：

```text
config/IKAnalyzer.cfg.xml
```

配置大概长这样：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
    <comment>IK Analyzer 扩展配置</comment>

    <!-- 用户可以在这里配置自己的扩展字典 -->
    <entry key="ext_dict">ext.dic</entry>

    <!-- 用户可以在这里配置自己的扩展停用词字典 -->
    <entry key="ext_stopwords">stopword.dic</entry>
</properties>
```

这里有两个配置项：

- `ext_dict`：扩展词典。比如项目里有一些专有名词、人名、业务词，希望 IK 把它们当成一个完整词，就可以放进这个文件。
- `ext_stopwords`：停用词词典。比如“的”“了”“啊”这类没有太多检索意义的词，可以放到停用词里，减少无效 token。

词典文件一般放在和 `IKAnalyzer.cfg.xml` 同一个 `config` 目录下，每行写一个词就行：

```text
问道之心
一线天机
韩立
```

改完配置和词典之后，记得重启 Elasticsearch，不然分词器不会重新加载这些文件：

```powershell
docker restart elasticsearch
```

重启后再用 `_analyze` 测一下，如果原本会被拆开的词，现在能作为完整 token 出现，就说明这份自定义词库已经生效了。

到这里，炼气期的基础法宝差不多齐了：Elasticsearch 负责存和搜，Kibana 负责看和调，IK 负责让中文搜索更像中文搜索。

## 筑基期：操作索引库与文档

环境装好之后，就可以开始筑基了。这个阶段不急着追求多复杂的查询，先把 Elasticsearch 最基础的一套操作打通：索引库怎么建，mapping 怎么写，索引库怎么查改删，文档怎么增删改查。

### 操作索引库

#### mapping 属性

Elasticsearch 里的 `mapping`，可以简单理解成“索引中文档的结构约束”。它告诉 Elasticsearch：这个字段是什么类型，要不要被索引，用什么分词器，里面还有没有子字段。

如果把索引比作一个储物袋，那 mapping 就是储物袋里的格子规则：丹药放哪一格，灵石放哪一格，功法玉简又该按什么方式登记。规则定得越清楚，后面查询时越不容易乱。

常见的 mapping 属性主要有这几个：

**type：字段数据类型**

`type` 用来定义字段的数据类型。不同类型会决定 Elasticsearch 怎么存这个字段、怎么建索引、后面能用哪些查询方式。

常见类型大概可以分成几类：

- 字符串：`text`、`keyword`
- 数值：`long`、`integer`、`short`、`byte`、`double`、`float`
- 布尔：`boolean`
- 日期：`date`
- 对象：`object`

这里最容易混的是 `text` 和 `keyword`。

`text` 是可分词文本，适合文章标题、正文、描述这类需要全文检索的字段。比如“你总是这样，遇到难回答的问题又不说话了”，用 `text` 类型后，Elasticsearch 可以先分词，再按词去搜索。

`keyword` 是精确值，不会被分词，适合品牌、状态、标签、枚举值这类需要完整匹配或聚合统计的字段。比如 `status` 是 `published`，就不希望它被拆开。

**index：是否创建索引**

`index` 表示这个字段是否参与索引，默认是 `true`。

如果一个字段设置了 `index: true`，就可以拿它做查询条件。如果设置成 `false`，这个字段仍然可以存进文档里，但不能直接拿来搜索。

比如有些字段只是用来展示，不参与查询，就可以考虑关掉索引，减少一点不必要的开销：

```json
{
  "properties": {
    "raw_content": {
      "type": "text",
      "index": false
    }
  }
}
```

简单理解就是：`index` 决定这个字段要不要登记进搜索名册。登记了，后面就能按它找；不登记，只能存着看。

**analyzer：使用哪种分词器**

`analyzer` 用来指定字段使用哪种分词器，通常只对 `text` 类型字段有意义。

比如中文内容可以指定前面安装的 IK 分词器：

```json
{
  "properties": {
    "content": {
      "type": "text",
      "analyzer": "ik_smart"
    }
  }
}
```

这样写之后，`content` 字段在写入和搜索时，就会按 `ik_smart` 的方式进行分词。要是想提高召回，也可以换成 `ik_max_word`，只是结果可能会更散一点。

**properties：对象里的子字段**

`properties` 用来定义字段的子字段。最常见的场景是对象类型，比如一篇文章里有作者信息：

```json
{
  "properties": {
    "author": {
      "type": "object",
      "properties": {
        "name": {
          "type": "keyword"
        },
        "age": {
          "type": "integer"
        }
      }
    }
  }
}
```

这里的 `author` 是一个对象，里面还有 `name` 和 `age` 两个子字段，所以需要继续用 `properties` 把内部结构写清楚。

#### 创建索引库

理解 mapping 之后，就可以真正创建索引库了。创建索引库本质上就是向 Elasticsearch 发一个 `PUT` 请求，把索引名称和 mapping 一起交给它。

```json
PUT /user
{
  "mappings": {
    "properties": {
      "info": {
        "type": "text",
        "analyzer": "ik_smart"
      },
      "email": {
        "type": "keyword",
        "index": false
      },
      "name": {
        "type": "object",
        "properties": {
          "firstName": {
            "type": "keyword"
          },
          "lastName": {
            "type": "keyword"
          }
        }
      }
    }
  }
}
```

执行成功后，Elasticsearch 会返回类似这样的结果：

```json
{
  "acknowledged" : true,
  "shards_acknowledged" : true,
  "index" : "user"
}
```

看到 `acknowledged: true`，说明这个索引库已经创建成功。筑基第一块砖，算是摆稳了。

#### 查询索引库

索引库建好以后，先查一下它长什么样：

```json
GET /user
```

这个请求会返回索引库的 settings 和 mappings。平时排查字段类型、分词器、索引配置时，经常会用它确认当前索引到底是不是自己以为的样子。

如果只想看 mapping，可以用：

```json
GET /user/_mapping
```

#### 删除索引库

如果索引库建错了，学习环境里可以直接删掉重来：

```json
DELETE /user
```

删除索引库要谨慎。这个操作不是删除一条文档，而是把整个索引库连同里面的数据一起抹掉。生产环境里执行这类命令之前，最好先停下来确认三遍。

#### 修改索引库

修改索引库时要注意：已经存在的字段类型通常不能直接改。比如一个字段已经是 `keyword`，后面不能随手改成 `text`。

不过可以新增字段，例如给用户补一个年龄字段：

```json
PUT /user/_mapping
{
  "properties": {
    "age": {
      "type": "integer"
    }
  }
}
```

所以 mapping 不是单纯的字段说明书，它会直接影响后面的搜索方式、分词效果、排序聚合和存储成本。创建索引前多想一分钟，后面少掉很多坑。

### 操作文档

#### 新增文档

有了索引库之后，就可以往里面放文档了。新增文档可以使用 `POST`，让 Elasticsearch 自动生成文档 ID：

```json
POST /user/_doc
{
  "info": "风光百年，同归尘土。问道之心，终归难改。",
  "email": "kepler@example.com",
  "name": {
    "firstName": "Kepler",
    "lastName": "Jai"
  },
  "age": 24
}
```

这里的字段要和前面 `user` 索引库的 mapping 对上：`info` 是会参与中文分词的文本，`email` 是精确值但不参与索引，`name` 是一个对象，里面有 `firstName` 和 `lastName` 两个子字段，`age` 是后面追加的整数类型字段。

如果想自己指定 ID，可以这样写：

```json
PUT /user/_doc/1
{
  "info": "在下不擅杀伐",
  "email": "hanli@example.com",
  "name": {
    "firstName": "Han",
    "lastName": "Li"
  }
  "age": 30
}
```

#### 查询文档

查询指定文档也很直接：

```json
GET /user/_doc/1
```

返回结果里重点看 `_source`，那里就是当初写进去的原始文档内容。

#### 删除文档

删除指定文档：

```json
DELETE /user/_doc/1
```

如果删除成功，返回结果里通常会看到 `"result": "deleted"`。

#### 修改文档

修改文档有两种常见方式。第一种是全量覆盖，还是用 `PUT /_doc/{id}`：

```json
PUT /user/_doc/1
{
  "info": "在下不擅杀伐。全量覆盖时，需要把整条文档重新交给 Elasticsearch。",
  "email": "hanli@example.com",
  "name": {
    "firstName": "Han",
    "lastName": "Li"
  },
  "age": 31
}
```

这种方式会用新内容替换旧文档，所以字段要写完整。少写的字段不会自动保留，容易一不小心把数据覆盖掉。

第二种是局部修改，用 `_update` 加 `doc`：

```json
POST /user/_update/1
{
  "doc": {
    "age": 32,
    "info": "局部修改只更新指定字段，更适合日常补数据。"
  }
}
```
