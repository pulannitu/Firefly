---
title: Elasticsearch基础文档
published: 2026-05-12
updated: 2026-05-15
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

本地现在跑的是 `Elasticsearch 9.4.0`，镜像使用 Elastic 官方地址：`docker.elastic.co/elasticsearch/elasticsearch:9.4.0`。它暴露了两个端口：

- `9200`：平时写接口、用浏览器、用 Postman 调 Elasticsearch，基本都是访问这个端口。
- `9300`：节点之间通信会用到的端口。现在只是单机学习，暂时不需要深究，先眼熟一下。

因为后面 Kibana 也要连上来，先建一个 Docker 网络：

```powershell
docker network create es-net
```

```powershell
docker run -d `
  --name elasticsearch `
  --network es-net `
  -p 9200:9200 `
  -p 9300:9300 `
  -e "discovery.type=single-node" `
  -e "xpack.security.enabled=false" `
  -e "ES_JAVA_OPTS=-Xms512m -Xmx512m" `
  -v "D:\workspace\software\IT\Docker\docker-volumes\docker-es\data:/usr/share/elasticsearch/data" `
  -v "D:\workspace\software\IT\Docker\docker-volumes\docker-es\plugins:/usr/share/elasticsearch/plugins" `
  -v "D:\workspace\software\IT\Docker\docker-volumes\docker-es\config\elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml" `
  docker.elastic.co/elasticsearch/elasticsearch:9.4.0
```

这里最关键的是 `discovery.type=single-node`。它的意思是告诉 Elasticsearch：别找其他节点了，我现在就是一个人闭关修炼。学习阶段用单节点模式最省心，不用一上来就被集群发现配置劝退。

这里还关掉了 `xpack.security.enabled`。ES 8 以后默认会开启安全认证，本地学习阶段先关掉，后面 Go 客户端和 Kibana 都可以继续直接访问 `http://localhost:9200`。

这次挂了几个目录：

- `data`：存索引数据，容器删了数据也尽量别跟着一起飞升。
- `plugins`：后面装 IK 分词器会用到。
- `elasticsearch.yml`：放自己的配置。

### 安装 Kibana

光有 Elasticsearch 也能学，但一直用命令行敲请求，多少有点像摸黑翻储物袋。Kibana 就是它的可视化控制台，后面查索引、看 mapping、调试 DSL 都会方便很多。

然后启动同版本的 Kibana：

```powershell
docker run -d `
  --name kibana `
  --network es-net `
  -p 5601:5601 `
  -e "ELASTICSEARCH_HOSTS=http://elasticsearch:9200" `
  docker.elastic.co/kibana/kibana:9.4.0
```

启动完成后，浏览器访问：

```text
http://localhost:5601
```

如果页面能打开，说明炼气期的第二件法器也备好了。

### 安装 IK 分词器

Elasticsearch 默认分词器对英文比较友好，但处理中文时就不太懂人情世故了。比如一句“我喜欢学习搜索引擎”，默认分词可能拆得比较生硬。学习中文搜索时，IK 分词器基本绕不开。

IK 插件版本要和 Elasticsearch 版本对齐。这里 ES 是 `9.4.0`，所以 IK 也要装 `9.4.0`。

先进入 Elasticsearch 容器内部：

```powershell
docker exec -it elasticsearch /bin/bash
```

然后在线下载安装 IK：

```powershell
./bin/elasticsearch-plugin install --batch https://release.infinilabs.com/analysis-ik/stable/elasticsearch-analysis-ik-9.4.0.zip
```

安装完成后退出容器：

```powershell
exit
```

最后重启 Elasticsearch，让插件正式生效：

```powershell
docker restart elasticsearch
```

重启之后可以看一下插件列表：

```powershell
Invoke-RestMethod http://localhost:9200/_cat/plugins?v
```

如果能看到 `analysis-ik 9.4.0`，就说明中文分词器已经就位。

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
/usr/share/elasticsearch/config/analysis-ik/IKAnalyzer.cfg.xml
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

#### 实战：酒店表映射成索引库

真正写业务时，一般会从 MySQL 表结构反推 Elasticsearch 的索引结构。比如现在有一张酒店表：

```sql
CREATE TABLE `tb_hotel`  (
  `id` bigint(20) NOT NULL COMMENT '酒店id',
  `name` varchar(255) NOT NULL COMMENT '酒店名称',
  `address` varchar(255) NOT NULL COMMENT '酒店地址',
  `price` int(10) NOT NULL COMMENT '酒店价格',
  `score` int(2) NOT NULL COMMENT '酒店评分',
  `brand` varchar(32) NOT NULL COMMENT '酒店品牌',
  `city` varchar(32) NOT NULL COMMENT '所在城市',
  `star_name` varchar(16) NULL DEFAULT NULL COMMENT '酒店星级，1星到5星，1钻到5钻',
  `business` varchar(255) NULL DEFAULT NULL COMMENT '商圈',
  `latitude` varchar(32) NOT NULL COMMENT '纬度',
  `longitude` varchar(32) NOT NULL COMMENT '经度',
  `pic` varchar(255) NULL DEFAULT NULL COMMENT '酒店图片',
  PRIMARY KEY (`id`) USING BTREE
);
```

如果直接照搬 MySQL 字段类型，肯定是不合适的。MySQL 关心的是关系型存储，Elasticsearch 更关心的是搜索、过滤、排序。以下是 `hotel` 索引库的 mapping：

```json
PUT /hotel
{
  "mappings": {
    "properties": {
      "id": {
        "type": "keyword"
      },
      "name": {
        "type": "text",
        "analyzer": "ik_max_word",
        "copy_to": "all"
      },
      "address": {
        "type": "keyword",
        "index": false
      },
      "price": {
        "type": "integer"
      },
      "score": {
        "type": "integer"
      },
      "brand": {
        "type": "keyword",
        "copy_to": "all"
      },
      "city": {
        "type": "keyword"
      },
      "startName": {
        "type": "keyword"
      },
      "business": {
        "type": "keyword",
        "copy_to": "all"
      },
      "location": {
        "type": "geo_point"
      },
      "pic": {
        "type": "keyword",
        "index": false
      },
      "all": {
        "type": "text",
        "analyzer": "ik_max_word"
      }
    }
  }
}
```

这里有两个字段选择比较关键。

 `copy_to`。它的作用是把多个字段的内容复制到一个统一字段里。这里我把 `name`、`brand`、`business` 都复制到了 `all`：

```json
{
  "name": {
    "type": "text",
    "analyzer": "ik_max_word",
    "copy_to": "all"
  },
  "brand": {
    "type": "keyword",
    "copy_to": "all"
  },
  "business": {
    "type": "keyword",
    "copy_to": "all"
  },
  "all": {
    "type": "text",
    "analyzer": "ik_max_word"
  }
}
```

这样做的好处是，用户搜索一个关键词时，不用分别查 `name`、`brand`、`business` 三个字段，只查 `all` 就行。比如用户搜“如家 西湖”，可能命中酒店名，也可能命中品牌，还可能命中商圈。

另一个重点是地理坐标。Elasticsearch 支持的地理坐标数据类型主要有两种：

- `geo_point`：表示一个具体的经纬度点，比如酒店位置、门店位置、用户当前位置。
- `geo_shape`：表示一个复杂的地理形状，比如一块商圈范围、一个行政区边界、一条路线、多边形区域。

这两个类型的使用场景不一样。`geo_point` 适合“点”的查询，比如附近酒店、按距离排序、判断某个点是否落在范围内。`geo_shape` 适合“形状”的查询，比如判断酒店是否在某个商圈多边形里，或者查询一条路线覆盖了哪些区域。

酒店表里只有经纬度，表达的是一个酒店所在的位置点，所以用 `geo_point` 就够了。MySQL 里经纬度分成了两个字段：

```text
latitude
longitude
```

但 Elasticsearch 里更适合合并成一个 `geo_point` 字段：

```json
"location": {
  "type": "geo_point"
}
```

有了 `geo_point`，后面就可以做附近酒店搜索、按距离排序、按地图范围过滤。写入文档时，可以把纬度和经度组装成下面这种对象形式：

```json
{
  "location": {
    "lat": 31.2304,
    "lon": 121.4737
  }
}
```

也可以写成字符串形式：

```json
{
  "location": "31.2304,121.4737"
}
```

> 这里要注意顺序：对象写法是 `lat` 和 `lon` 分开，比较不容易看错；字符串写法通常是 `"纬度,经度"`。
>

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

## 结丹期：使用 Go 客户端操作 Elasticsearch

前面都是在 Kibana 或 HTTP 请求里手动操作 Elasticsearch，到了这一阶段，就该把这些操作接到 Go 代码里了。

### 初始化 Go 客户端

先安装 Elasticsearch 官方 Go 客户端依赖：

```powershell
go get github.com/elastic/go-elasticsearch/v9@v9.4.0
```

初始化代码如下：

```go
var ESClient *elasticsearch.Client

// InitESClient 初始化 Elasticsearch 客户端。
func InitESClient(addresses ...string) (*elasticsearch.Client, error) {
	if len(addresses) == 0 {
		addresses = []string{"http://localhost:9200"}
	}

	client, err := elasticsearch.New(elasticsearch.WithAddresses(addresses...))
	if err != nil {
		return nil, fmt.Errorf("创建 Elasticsearch 客户端失败: %w", err)
	}

	ESClient = client

	return client, nil
}
```

### 操作索引

这一部分主要把前面手写的索引库操作搬到 Go 代码里。

#### 公共响应处理

无论操作索引库还是操作文档，Elasticsearch 都可能返回错误状态。这里先把响应体读取和错误检查提取成公共函数，后面的创建、查询、修改、删除都复用它：

```go
// checkResponse 检查 Elasticsearch 响应是否为错误状态。
func checkResponse(res *esapi.Response, action string) error {
	if !res.IsError() {
		return nil
	}

	body, err := readResponseBody(res.Body)
	if err != nil {
		return fmt.Errorf("%s失败，状态码: %s，且读取响应体失败: %w", action, res.Status(), err)
	}

	return fmt.Errorf("%s失败，状态码: %s，响应: %s", action, res.Status(), body)
}

// readResponseBody 读取 Elasticsearch 响应体并转成字符串。
func readResponseBody(body io.Reader) (string, error) {
	data, err := io.ReadAll(body)
	if err != nil {
		return "", err
	}

	return string(data), nil
}
```

`checkResponse` 只在 ES 返回错误状态码时读取响应体；`readResponseBody` 则用于查询类接口，把返回结果转成字符串方便打印或后续解析。

#### 创建索引库

```go
// hotelIndexMapping 定义 hotel 索引库的 mapping。
const hotelIndexMapping = `{
  "mappings": {
    "properties": {
      "id": {
        "type": "keyword"
      },
      "name": {
        "type": "text",
        "analyzer": "ik_max_word",
        "copy_to": "all"
      },
      "address": {
        "type": "keyword",
        "index": false
      },
      "price": {
        "type": "integer"
      },
      "score": {
        "type": "integer"
      },
      "brand": {
        "type": "keyword",
        "copy_to": "all"
      },
      "city": {
        "type": "keyword"
      },
      "startName": {
        "type": "keyword"
      },
      "business": {
        "type": "keyword",
        "copy_to": "all"
      },
      "location": {
        "type": "geo_point"
      },
      "pic": {
        "type": "keyword",
        "index": false
      },
      "all": {
        "type": "text",
        "analyzer": "ik_max_word"
      }
    }
  }
}`

// CreateHotelIndex 创建 hotel 索引库。
func CreateHotelIndex(ctx context.Context, client *elasticsearch.Client) error {
	res, err := client.Indices.Create(
		"hotel",
		client.Indices.Create.WithContext(ctx),
		client.Indices.Create.WithBody(strings.NewReader(hotelIndexMapping)),
	)
	if err != nil {
		return fmt.Errorf("请求 Elasticsearch 创建 hotel 索引库失败: %w", err)
	}
	defer res.Body.Close()

	return checkResponse(res, "创建 hotel 索引库")
}
```

#### 查询索引库

查询索引库使用 `client.Indices.Get`，返回结果里会包含 settings、mappings 等信息：

```go
// GetHotelIndex 查询 hotel 索引库信息。
// 参数 ctx 用于控制请求生命周期，client 是已经初始化好的 Elasticsearch 客户端。
// 返回值为 Elasticsearch 返回的索引库 JSON 信息和可能出现的错误。
func GetHotelIndex(ctx context.Context, client *elasticsearch.Client) (string, error) {
	// 查询索引库信息，返回结果中包含 settings、mappings 等内容。
	res, err := client.Indices.Get(
		[]string{"hotel"},
		client.Indices.Get.WithContext(ctx),
	)
	if err != nil {
		return "", fmt.Errorf("请求 Elasticsearch 查询 hotel 索引库失败: %w", err)
	}
	defer res.Body.Close()

	body, err := readResponseBody(res.Body)
	if err != nil {
		return "", fmt.Errorf("读取 hotel 索引库查询响应失败: %w", err)
	}

	if res.IsError() {
		return "", fmt.Errorf("查询 hotel 索引库失败，状态码: %s，响应: %s", res.Status(), body)
	}

	return body, nil
}
```

#### 修改索引库

修改索引库通常指追加新的 mapping 字段。已经存在的字段类型一般不能直接修改，所以这里演示给 `hotel` 追加一个 `remark` 字段：

```go
// hotelExtraMapping 定义追加到 hotel 索引库的字段 mapping。
const hotelExtraMapping = `{
  "properties": {
    "remark": {
      "type": "text",
      "analyzer": "ik_max_word"
    }
  }
}`

// UpdateHotelIndexMapping 给 hotel 索引库追加字段 mapping。
func UpdateHotelIndexMapping(ctx context.Context, client *elasticsearch.Client) error {
	// 已存在字段的类型通常不能修改，只能追加新的字段 mapping。
	res, err := client.Indices.PutMapping(
		[]string{"hotel"},
		strings.NewReader(hotelExtraMapping),
		client.Indices.PutMapping.WithContext(ctx),
	)
	if err != nil {
		return fmt.Errorf("请求 Elasticsearch 修改 hotel 索引库 mapping 失败: %w", err)
	}
	defer res.Body.Close()

	return checkResponse(res, "修改 hotel 索引库 mapping")
}
```

`PutMapping` 的第二个参数就是请求体，所以这里直接把 `hotelExtraMapping` 转成 `strings.NewReader` 传进去。

#### 删除索引库

删除索引库使用 `client.Indices.Delete`。这个操作会把索引库和里面的文档一起删除，学习环境可以大胆一点，生产环境必须慎重。

```go
// DeleteHotelIndex 删除 hotel 索引库。
func DeleteHotelIndex(ctx context.Context, client *elasticsearch.Client) error {
	// 删除索引库会连同其中所有文档一起删除，学习环境执行前也要确认目标索引名。
	res, err := client.Indices.Delete(
		[]string{"hotel"},
		client.Indices.Delete.WithContext(ctx),
	)
	if err != nil {
		return fmt.Errorf("请求 Elasticsearch 删除 hotel 索引库失败: %w", err)
	}
	defer res.Body.Close()

	return checkResponse(res, "删除 hotel 索引库")
}
```

### 操作文档

索引库准备好之后，下一步就是用 Go 操作文档。

先定义和 `hotel` 索引库对应的 Go 结构体。这里的 `Location` 对应前面 mapping 里的 `geo_point`：

```go
// GeoLocation 表示 Elasticsearch geo_point 坐标。
type GeoLocation struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// HotelDoc 表示写入 hotel 索引库的酒店文档。
type HotelDoc struct {
	ID        int64       `json:"id"`
	Name      string      `json:"name"`
	Address   string      `json:"address"`
	Price     int         `json:"price"`
	Score     int         `json:"score"`
	Brand     string      `json:"brand"`
	City      string      `json:"city"`
	StartName string      `json:"startName"`
	Business  string      `json:"business"`
	Location  GeoLocation `json:"location"`
	Pic       string      `json:"pic"`
}
```

#### 新增文档

新增文档时，先把 Go 结构体序列化为 JSON，再调用 `client.Index` 写入 ES：

```go
// hotelDocForDemo 构造用于演示的酒店文档。
func hotelDocForDemo() HotelDoc {
	return HotelDoc{
		ID:        1,
		Name:      "如家精选酒店",
		Address:   "上海市黄浦区人民广场",
		Price:     399,
		Score:     45,
		Brand:     "如家",
		City:      "上海",
		StartName: "三钻",
		Business:  "人民广场",
		Location: GeoLocation{
			Lat: 31.2304,
			Lon: 121.4737,
		},
		Pic: "https://example.com/hotel.jpg",
	}
}

// CreateHotelDocument 新增或全量覆盖 hotel 文档。
func CreateHotelDocument(ctx context.Context, client *elasticsearch.Client) error {
	// 将 Go 结构体序列化为 JSON，作为 Elasticsearch 文档请求体。
	doc, err := json.Marshal(hotelDocForDemo())
	if err != nil {
		return fmt.Errorf("序列化 hotel 文档失败: %w", err)
	}

	res, err := client.Index(
		"hotel",
		strings.NewReader(string(doc)),
		client.Index.WithContext(ctx),
		client.Index.WithDocumentID("1"),
		client.Index.WithRefresh("true"),
	)
	if err != nil {
		return fmt.Errorf("请求 Elasticsearch 新增 hotel 文档失败: %w", err)
	}
	defer res.Body.Close()

	return checkResponse(res, "新增 hotel 文档")
}
```

`client.Index.WithDocumentID("1")` 表示手动指定文档 ID。`WithRefresh("true")` 是为了学习时立刻能查到刚写入的数据，真实业务里不一定每次都要这样做。

#### 批量导入文档

批量导入文档使用 `client.Bulk`。Bulk API 的请求体不是普通 JSON 数组，而是 NDJSON：每个操作由两行组成，第一行是操作元数据，第二行是文档内容，并且每一行都要以换行符结尾。

```go
// hotelDocsForBulkDemo 构造用于批量导入演示的酒店文档列表。
func hotelDocsForBulkDemo() []HotelDoc {
	// 先复用单条文档示例，保证字段结构和前面的 mapping 保持一致。
	first := hotelDocForDemo()

	// 再构造第二条文档，用不同 ID 演示 Bulk 一次写入多条数据。
	second := hotelDocForDemo()
	second.ID = 2
	second.Name = "汉庭酒店"
	second.Address = "上海市静安区南京西路"
	second.Price = 329
	second.Score = 43
	second.Brand = "汉庭"
	second.Business = "南京西路"
	second.Location = GeoLocation{Lat: 31.2336, Lon: 121.4563}

	return []HotelDoc{first, second}
}

// BulkCreateHotelDocuments 批量导入 hotel 文档。
func BulkCreateHotelDocuments(ctx context.Context, client *elasticsearch.Client, docs []HotelDoc) error {
	// 批量导入没有数据时直接返回，避免向 Elasticsearch 发送空的 bulk 请求。
	if len(docs) == 0 {
		return nil
	}

	// Bulk API 使用 NDJSON 格式，每条文档都需要先写操作行，再写数据行。
	var body strings.Builder
	for _, doc := range docs {
		// index 操作表示新增或覆盖文档，这里显式指定索引名和文档ID。
		// Bulk API 里的每一条操作，都需要一行操作元数据,表示：我要执行index操作，目标索引库是hotel，文档ID是doc.ID
		// 如果是单条新增，就不需要自己写外面这一层，因为索引名和文档ID已经通过API参数传了
		meta := map[string]map[string]string{
			"index": {
				"_index": "hotel",
				"_id":    fmt.Sprintf("%d", doc.ID),
			},
		}

		// 序列化操作元数据，避免手写 JSON 字符串导致格式错误。
		metaLine, err := json.Marshal(meta)
		if err != nil {
			return fmt.Errorf("序列化 hotel 批量导入元数据失败: %w", err)
		}

		// 序列化文档内容，作为 index 操作的下一行数据。
		docLine, err := json.Marshal(doc)
		if err != nil {
			return fmt.Errorf("序列化 hotel 批量导入文档失败: %w", err)
		}

		// 每一行都必须追加换行符，最后一行也不能省略换行。
		body.Write(metaLine)
		body.WriteByte('\n')
		body.Write(docLine)
		body.WriteByte('\n')
	}

	// 发送批量请求；学习环境使用 refresh=true，方便马上查询导入结果。
	res, err := client.Bulk(
		strings.NewReader(body.String()),
		client.Bulk.WithContext(ctx),
		client.Bulk.WithRefresh("true"),
	)
	if err != nil {
		return fmt.Errorf("请求 Elasticsearch 批量导入 hotel 文档失败: %w", err)
	}
	defer res.Body.Close()

	// Bulk 响应需要读取出来，因为 HTTP 200 也可能包含单条写入失败。
	respBody, err := readResponseBody(res.Body)
	if err != nil {
		return fmt.Errorf("读取 hotel 批量导入响应失败: %w", err)
	}

	// 先检查整个 Bulk 请求本身是否失败。
	if res.IsError() {
		return fmt.Errorf("批量导入 hotel 文档失败，状态码: %s，响应: %s", res.Status(), respBody)
	}

	// 再检查 Bulk 响应里的 errors 字段，确认是否存在单条文档失败。
	var result struct {
		Errors bool `json:"errors"`
	}
	if err := json.Unmarshal([]byte(respBody), &result); err != nil {
		return fmt.Errorf("解析 hotel 批量导入响应失败: %w", err)
	}
	if result.Errors {
		return fmt.Errorf("批量导入 hotel 文档存在失败项，响应: %s", respBody)
	}

	return nil
}
```

这里用的是 `index` 动作，所以语义和单条 `client.Index` 一样：文档 ID 不存在时创建，文档 ID 已存在时覆盖。真实业务从 MySQL 批量同步到 Elasticsearch 时，通常就会用 Bulk API，而不是在循环里一条一条调用 `client.Index`。

#### 查询文档

查询文档直接使用 `client.Get`，索引名和文档 ID 都要传进去：

```go
// GetHotelDocument 根据文档 ID 查询 hotel 文档。
func GetHotelDocument(ctx context.Context, client *elasticsearch.Client, id string) (string, error) {
	res, err := client.Get(
		"hotel",
		id,
		client.Get.WithContext(ctx),
	)
	if err != nil {
		return "", fmt.Errorf("请求 Elasticsearch 查询 hotel 文档失败: %w", err)
	}
	defer res.Body.Close()

	body, err := readResponseBody(res.Body)
	if err != nil {
		return "", fmt.Errorf("读取 hotel 文档查询响应失败: %w", err)
	}

	if res.IsError() {
		return "", fmt.Errorf("查询 hotel 文档失败，状态码: %s，响应: %s", res.Status(), body)
	}

	return body, nil
}
```

返回结果里重点看 `_source`，那里才是写入时的原始业务数据。

#### 修改文档

第一种是局部修改。局部修改文档使用 `client.Update`，请求体需要包一层 `doc`：

```go
// UpdateHotelDocument 局部修改 hotel 文档。
func UpdateHotelDocument(ctx context.Context, client *elasticsearch.Client, id string) error {
	body := `{
  "doc": {
    "price": 429,
    "remark": "靠近人民广场，适合出差住宿"
  }
}`

	res, err := client.Update(
		"hotel",
		id,
		strings.NewReader(body),
		client.Update.WithContext(ctx),
		client.Update.WithRefresh("true"),
	)
	if err != nil {
		return fmt.Errorf("请求 Elasticsearch 修改 hotel 文档失败: %w", err)
	}
	defer res.Body.Close()

	return checkResponse(res, "修改 hotel 文档")
}
```

这里修改了 `price`，并新增了 `remark`。前面操作索引时已经给 `hotel` 追加过 `remark` 的 mapping，所以这两个步骤可以串起来练。

第二种是全量覆盖。全量覆盖文档仍然使用 `client.Index`。当指定相同文档 ID 时，Elasticsearch 会用新的请求体覆盖原来的 `_source`；如果新请求体没有带某个字段，这个字段就不会继续保留。它和 `client.Update` 的区别是：`Update` 会把 `doc` 合并到旧文档里，而 `Index` 是重新写入整篇文档。

```go
// ReplaceHotelDocument 全量覆盖 hotel 文档。
func ReplaceHotelDocument(ctx context.Context, client *elasticsearch.Client, id string) error {
	// 先构造一份完整文档；全量覆盖必须提交完整 _source，避免重要字段被意外清空。
	doc := hotelDocForDemo()
	doc.Price = 459
	doc.Score = 48

	// 将完整文档序列化为 JSON，作为覆盖写入的请求体。
	body, err := json.Marshal(doc)
	if err != nil {
		return fmt.Errorf("序列化 hotel 覆盖文档失败: %w", err)
	}

	// 对同一个文档 ID 再次执行 Index，Elasticsearch 会用请求体覆盖该文档的 _source。
	res, err := client.Index(
		"hotel",
		strings.NewReader(string(body)),
		client.Index.WithContext(ctx),
		client.Index.WithDocumentID(id),
		client.Index.WithRefresh("true"),
	)
	if err != nil {
		return fmt.Errorf("请求 Elasticsearch 全量覆盖 hotel 文档失败: %w", err)
	}
	defer res.Body.Close()

	return checkResponse(res, "全量覆盖 hotel 文档")
}
```

这里要特别注意：`client.Index` 指定同一个文档 ID 时既可以新增，也可以覆盖。如果这个 ID 原来不存在，它会创建新文档；如果已经存在，它会覆盖旧文档。因此全量覆盖前要确保请求体就是你希望最终保留下来的完整文档。

#### 删除文档

删除文档使用 `client.Delete`：

```go
// DeleteHotelDocument 根据文档 ID 删除 hotel 文档。
func DeleteHotelDocument(ctx context.Context, client *elasticsearch.Client, id string) error {
	res, err := client.Delete(
		"hotel",
		id,
		client.Delete.WithContext(ctx),
		client.Delete.WithRefresh("true"),
	)
	if err != nil {
		return fmt.Errorf("请求 Elasticsearch 删除 hotel 文档失败: %w", err)
	}
	defer res.Body.Close()

	return checkResponse(res, "删除 hotel 文档")
}
```

同样，`WithRefresh("true")` 是为了方便本地学习时立刻看到删除效果。
