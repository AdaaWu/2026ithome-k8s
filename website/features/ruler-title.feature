Feature: 成為 K8s 雲之島統治大王

  Scenario: 30 關全破且圖鑑全收集
    Given 玩家暱稱是 "小桑"
    And 玩家已經通過全部 30 天關卡
    When 玩家答對圖鑑裡所有角色
    Then 玩家的稱號是 "K8s 雲之島統治大王"

  Scenario: 關卡全破但圖鑑缺一隻
    Given 玩家暱稱是 "小桑"
    And 玩家已經通過全部 30 天關卡
    When 玩家答對圖鑑裡除了一隻以外的所有角色
    Then 玩家的稱號是 "雲之島守護者"

  Scenario: 存檔重新整理後還在
    Given 玩家暱稱是 "小桑"
    And 玩家已經通過第 3 天
    When 玩家重新整理頁面
    Then 玩家暱稱仍是 "小桑"
    And 第 3 天顯示為已通過
