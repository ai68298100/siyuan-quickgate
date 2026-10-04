// 编译验证专用桩：模拟 Quicker 宿主的 IStepContext 接口（仅 csc 语法检查用，不随动作分发）
using System.Collections.Generic;

namespace Quicker.Public
{
    public interface IStepContext
    {
        object GetVarValue(string name);
        void SetVarValue(string name, object value);
    }
}

public static class __QuickerStub
{
    public static void Main() { }
}
