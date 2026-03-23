from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class AwsToolDefinition:
    tool_name: str
    endpoint: str
    summary: str
    use_when: str
    response_shape: str
    required_inputs: tuple[str, ...]
    optional_inputs: tuple[str, ...] = ()
    cache_value: str = "medium"
    live_call_required: bool = True
    trigger_phrases: tuple[str, ...] = ()


AWS_TOOL_CATALOG: tuple[AwsToolDefinition, ...] = (
    AwsToolDefinition(
        tool_name="accounts",
        endpoint="/api/v1/aws/accounts",
        summary="Lists configured AWS accounts and resolved account ids.",
        use_when=(
            "Use when the user asks which AWS accounts are available, which environments "
            "exist, or which account aliases can be selected."
        ),
        response_shape="Returns `accounts[]` with `account_key`, `account_id`, and `region`.",
        required_inputs=(),
        cache_value="low",
        live_call_required=False,
        trigger_phrases=("accounts", "available accounts", "which environments"),
    ),
    AwsToolDefinition(
        tool_name="cost_breakdown",
        endpoint="/api/v1/aws/cost-breakdown",
        summary="Returns total AWS cost and top costly services for each account.",
        use_when=(
            "Use when the user asks for top costly services, largest spend drivers, "
            "cost split, or service-wise breakdown."
        ),
        response_shape=(
            "Returns `total_cost` plus `breakdown[]` with `service`, `cost`, and `percentage`."
        ),
        required_inputs=("days",),
        optional_inputs=("account_keys", "top_n"),
        cache_value="high",
        live_call_required=True,
        trigger_phrases=(
            "top services",
            "highest cost services",
            "cost breakdown",
            "largest spend drivers",
        ),
    ),
    AwsToolDefinition(
        tool_name="total_cost",
        endpoint="/api/v1/aws/total-cost",
        summary="Returns total AWS cost and service totals for each account.",
        use_when=(
            "Use when the user asks how much was spent overall during a time window."
        ),
        response_shape="Returns `total_cost` and `service_costs` mapping per account.",
        required_inputs=("days",),
        optional_inputs=("account_keys",),
        cache_value="high",
        live_call_required=True,
        trigger_phrases=("total cost", "how much spent", "overall spend", "total spend"),
    ),
    AwsToolDefinition(
        tool_name="service_costs",
        endpoint="/api/v1/aws/service-costs",
        summary="Returns the full service-to-cost mapping for each account.",
        use_when=(
            "Use when the user wants a detailed full list of service costs instead of only top services."
        ),
        response_shape="Returns `service_costs` as a full service-to-cost dictionary.",
        required_inputs=("days",),
        optional_inputs=("account_keys",),
        cache_value="high",
        live_call_required=True,
        trigger_phrases=("all service costs", "detailed service costs", "service wise spend"),
    ),
    AwsToolDefinition(
        tool_name="trends_forecast",
        endpoint="/api/v1/aws/trends-forecast",
        summary="Returns monthly spend trend, forecast, and anomaly list.",
        use_when=(
            "Use when the user asks about trend, month-over-month movement, forecast, or anomalies."
        ),
        response_shape=(
            "Returns `actual[]`, `forecast[]`, and `anomalies[]` per account."
        ),
        required_inputs=("days",),
        optional_inputs=("account_keys",),
        cache_value="high",
        live_call_required=True,
        trigger_phrases=("trend", "forecast", "anomaly", "month over month"),
    ),
    AwsToolDefinition(
        tool_name="budget",
        endpoint="/api/v1/aws/budget",
        summary="Returns AWS budget utilization for a named budget.",
        use_when=(
            "Use when the user asks about budget usage, remaining budget, or budget utilization."
        ),
        response_shape=(
            "Returns `budget_name`, `limit`, `actual_spent`, and `utilization_pct`."
        ),
        required_inputs=("budget_name",),
        optional_inputs=("account_keys", "days"),
        cache_value="medium",
        live_call_required=True,
        trigger_phrases=("budget", "budget utilization", "budget usage"),
    ),
    AwsToolDefinition(
        tool_name="resource_cost",
        endpoint="/api/v1/aws/resource-cost",
        summary="Returns cost for one specific AWS resource id.",
        use_when=(
            "Use when the user asks about a specific resource id such as an EC2 instance."
        ),
        response_shape="Returns `resource_id` and `total_cost` per account.",
        required_inputs=("resource_id", "days"),
        optional_inputs=("account_keys",),
        cache_value="medium",
        live_call_required=True,
        trigger_phrases=("resource cost", "instance cost", "resource id"),
    ),
    AwsToolDefinition(
        tool_name="ec2_idle_check",
        endpoint="/api/v1/aws/ec2/idle-check",
        summary="Checks whether EC2 instances look idle from CPU and network metrics.",
        use_when=(
            "Use when the user asks whether EC2 instances are idle, underused, or candidates to stop."
        ),
        response_shape=(
            "Returns `instances[]` with `instance_id`, `cpu_idle`, `network_idle`, and `idle`."
        ),
        required_inputs=("instance_ids",),
        optional_inputs=("account_keys", "idle_days", "cpu_threshold", "network_threshold_bytes", "days"),
        cache_value="medium",
        live_call_required=True,
        trigger_phrases=("idle ec2", "unused instance", "idle check", "underused instance"),
    ),
)


def get_aws_tool_catalog() -> tuple[AwsToolDefinition, ...]:
    return AWS_TOOL_CATALOG


def build_tool_catalog_prompt() -> str:
    lines = [
        "Available AWS tools:",
    ]
    for tool in AWS_TOOL_CATALOG:
        lines.append(
            (
                f"- {tool.tool_name}: endpoint={tool.endpoint}; summary={tool.summary} "
                f"use_when={tool.use_when} required_inputs={', '.join(tool.required_inputs) or 'none'} "
                f"optional_inputs={', '.join(tool.optional_inputs) or 'none'} "
                f"response_shape={tool.response_shape}"
            )
        )
    return "\n".join(lines)
