Feature: 角色圖鑑猜影子

  Scenario: 答對影子題，角色變彩色
    Given 圖鑑裡有一隻影子角色 "bird"
    When 玩家點開影子 "bird"
    And 玩家選擇 "Container（容器）"
    Then 角色 "bird" 變成彩色
    And 角色 "bird" 被記錄為看過

  Scenario: 答錯影子題，角色維持影子
    Given 圖鑑裡有一隻影子角色 "bird"
    When 玩家點開影子 "bird"
    And 玩家選擇 "Node（節點）"
    Then 角色 "bird" 仍然是影子
    And 角色 "bird" 被記錄為看過
